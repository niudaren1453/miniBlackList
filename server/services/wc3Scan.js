'use strict'

const path = require('node:path')
const AsyncLock = require('async-lock')
const sharp = require('sharp')
const { createWorker } = require('tesseract.js')

const { HttpError } = require('../utils/errors')

const MAX_IMAGE_WIDTH = 2200
const MAX_IMAGE_HEIGHT = 1600
const MAX_INPUT_PIXELS = 36_000_000
const OCR_LANG_PATH = path.join(
  path.dirname(require.resolve('@tesseract.js-data/eng/package.json')),
  '4.0.0_best_int'
)

const scanLock = new AsyncLock()
let workerPromise = null

const NON_PLAYER_WORDS = new Set([
  'computer',
  'defenders',
  'evil',
  'forces',
  'human',
  'normal',
  'open',
  'player',
  'random',
  'dalaran',
  'no',
  'noob'
])

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      langPath: OCR_LANG_PATH,
      gzip: true,
      cacheMethod: 'none'
    })
      .then(async (worker) => {
        await worker.setParameters({
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1'
        })
        return worker
      })
      .catch((error) => {
        workerPromise = null
        throw error
      })
  }

  return workerPromise
}

async function resetWorker() {
  const pending = workerPromise
  workerPromise = null

  if (pending) {
    try {
      const worker = await pending
      await worker.terminate()
    } catch (error) {
      // Worker 已经异常时直接丢弃即可。
    }
  }
}

/**
 * 将上传图片统一转成限制尺寸的 PNG，避免超大图片拖垮 OCR。
 */
async function prepareImage(buffer) {
  let metadata

  try {
    metadata = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS
    }).metadata()
  } catch (error) {
    throw new HttpError(400, '无法读取图片，请上传有效的 PNG/JPG/WebP 文件')
  }

  if (!metadata.format || !['png', 'jpeg', 'webp'].includes(metadata.format)) {
    throw new HttpError(400, '仅支持 PNG、JPG、WebP 格式的图片')
  }

  if (!metadata.width || !metadata.height) {
    throw new HttpError(400, '图片尺寸信息无效')
  }

  if (metadata.width < 500 || metadata.height < 250) {
    throw new HttpError(400, '图片尺寸过小，请上传完整的 WC3 大厅截图')
  }

  const normalized = await sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS
  })
    .rotate()
    .resize({
      width: MAX_IMAGE_WIDTH,
      height: MAX_IMAGE_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png()
    .toBuffer()

  const normalizedMetadata = await sharp(normalized).metadata()

  return {
    buffer: normalized,
    width: normalizedMetadata.width,
    height: normalizedMetadata.height
  }
}

/**
 * 通过玩家颜色块定位大厅里的每一行玩家。
 * WC3 的玩家色块是近似正方形的高饱和色块，稳定出现在玩家名左侧。
 */
function findPlayerColorSquares(raw, info) {
  const { width, height, channels } = info
  const mask = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels
      const r = raw[offset]
      const g = raw[offset + 1]
      const b = raw[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)

      if (max >= 60 && max - min >= 50) {
        mask[y * width + x] = 1
      }
    }
  }

  const seen = new Uint8Array(width * height)
  const stack = []
  const squares = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (!mask[start] || seen[start]) continue

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let area = 0

      stack.push(start)
      seen[start] = 1

      while (stack.length) {
        const index = stack.pop()
        const px = index % width
        const py = (index / width) | 0
        area += 1
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py

        const neighbours = [
          index - 1,
          index + 1,
          index - width,
          index + width
        ]

        for (const next of neighbours) {
          if (next < 0 || next >= mask.length || seen[next] || !mask[next]) {
            continue
          }

          const nx = next % width
          const ny = (next / width) | 0
          if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue

          seen[next] = 1
          stack.push(next)
        }
      }

      const w = maxX - minX + 1
      const h = maxY - minY + 1
      const ratio = w / h
      const fill = area / (w * h)
      const yRatio = minY / height

      if (
        area >= 100 &&
        w >= 14 &&
        h >= 14 &&
        w <= 55 &&
        h <= 55 &&
        fill >= 0.5 &&
        ratio >= 0.55 &&
        ratio <= 1.6 &&
        yRatio > 0.12 &&
        yRatio < 0.92
      ) {
        squares.push({ x: minX, y: minY, w, h })
      }
    }
  }

  return squares.sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * 同一列玩家的第一行红色色块容易被边框连成一个大色块而漏检。
 * 如果某列至少识别到两行，就按行距向上补一行；补出来的第一行通常是房主。
 */
function inferFirstRows(squares, imageHeight) {
  const groups = []

  for (const square of squares) {
    let group = groups.find((item) => Math.abs(item.x - square.x) < 12)
    if (!group) {
      group = { x: square.x, squares: [] }
      groups.push(group)
    }
    group.squares.push(square)
  }

  const result = [...squares]

  for (const group of groups) {
    if (group.squares.length < 2) continue

    group.squares.sort((a, b) => a.y - b.y)
    const gaps = []
    for (let i = 1; i < group.squares.length; i += 1) {
      gaps.push(group.squares[i].y - group.squares[i - 1].y)
    }

    const spacing = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    if (spacing < 35 || spacing > 90) continue

    const first = group.squares[0]
    const inferredY = first.y - Math.round(spacing)

    if (inferredY > imageHeight * 0.2) {
      result.push({ ...first, y: inferredY, inferred: true })
    }
  }

  return result.sort((a, b) => a.y - b.y || a.x - b.x)
}

function cleanOcrLine(line) {
  return line
    .replace(/[\u2500-\u257F]/g, ' ')
    .replace(/[|"'`“”‘’]/g, ' ')
    .replace(/[—–_=~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}[]+/u, '')
    .replace(/[^\p{L}\p{N}.\])]+$/u, '')
    .trim()
}

function isNonPlayerLabel(value) {
  if (!value) return true
  if (/[\u4e00-\u9fff]/.test(value)) {
    return /电脑|普通|随机|人类|亡灵|开放/.test(value)
  }

  const words = value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) return true
  if (words.every((word) => NON_PLAYER_WORDS.has(word))) return true

  // OCR 读取“电脑(普通)”时经常得到类似 "ERB (EIE)" 的短标签。
  if (/^[A-Z]{2,4}\s*\(\s*[A-Z]{2,4}\s*\)$/i.test(value)) return true
  if (/^\d+%$/.test(value)) return true

  return false
}

function pickPlayerName(text, confidence) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => cleanOcrLine(line))
    .filter(Boolean)

  // 电脑玩家在中文客户端里通常会被 OCR 成一串带括号的短标签；
  // 只要整行命中这种形态，就把整行 OCR 结果视为电脑/UI，而不是玩家。
  const hasComputerLabel = lines.some(
    (line) =>
      /^[A-Z]{2,4}\s*\(\s*[A-Z]{2,4}\s*\)$/i.test(line) ||
      /电脑|普通/.test(line)
  )
  if (hasComputerLabel) return null

  const candidates = []

  for (const line of lines) {
    if (line.length < 2 || line.length > 30) continue
    if (isNonPlayerLabel(line)) continue

    const alphanumeric = (line.match(/[\p{L}\p{N}]/gu) || []).length
    if (alphanumeric < 2) continue
    if (line.split(/\s+/).length > 3) continue

    let score = alphanumeric + confidence / 20
    if (/\d/.test(line)) score += 1
    if (line.length >= 5) score += 1

    candidates.push({ name: line, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.name || null
}

function percentile(values, ratio) {
  if (!values.length) return 27
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.floor((sorted.length - 1) * ratio))]
}

async function cropNameRegion(image, square, baseSquareWidth) {
  const left = Math.max(
    0,
    Math.min(
      image.width - 20,
      square.x + square.w + Math.round(baseSquareWidth * 0.75)
    )
  )
  const top = Math.max(0, square.y - Math.round(square.h * 0.8))
  const width = Math.min(
    image.width - left,
    Math.max(200, Math.min(420, Math.round(baseSquareWidth * 11.3)))
  )
  const height = Math.min(
    image.height - top,
    Math.round(square.h * 1.8)
  )

  const buffer = await sharp(image.buffer)
    .extract({ left, top, width, height })
    .resize({ width: width * 3, kernel: 'lanczos3' })
    .grayscale()
    .negate()
    .linear(1.8, -45)
    .normalize()
    .sharpen()
    .png()
    .toBuffer()

  return buffer
}

async function recognizeRows(image, squares) {
  const widths = squares.filter((square) => !square.inferred).map((square) => square.w)
  const baseSquareWidth = percentile(widths, 0.25)
  const names = []

  return scanLock.acquire('wc3-lobby-ocr', async () => {
    let worker

    try {
      worker = await getWorker()
    } catch (error) {
      await resetWorker()
      throw new HttpError(422, 'OCR 引擎初始化失败，请稍后重试')
    }

    try {
      for (const square of squares) {
        const crop = await cropNameRegion(image, square, baseSquareWidth)
        const { data } = await worker.recognize(crop)
        const name = pickPlayerName(data.text, data.confidence || 0)

        if (process.env.WC3_OCR_DEBUG === '1') {
          console.log(
            '[wc3-ocr]',
            JSON.stringify({
              x: square.x,
              y: square.y,
              w: square.w,
              h: square.h,
              inferred: Boolean(square.inferred),
              text: data.text.trim(),
              picked: name,
              confidence: data.confidence
            })
          )
        }

        if (!name) continue

        names.push({
          name,
          confidence: Math.round(data.confidence || 0),
          source: square.inferred ? 'host' : 'player'
        })
      }
    } catch (error) {
      await resetWorker()
      throw new HttpError(422, '图片 OCR 识别失败，请更换清晰截图后重试')
    }

    return names
  })
}

function dedupeNames(names) {
  const seen = new Map()

  for (const item of names) {
    const key = item.name.normalize('NFKC').trim().toLowerCase()
    const current = seen.get(key)

    if (!current || item.confidence > current.confidence) {
      seen.set(key, item)
    }
  }

  return [...seen.values()]
}

async function scanLobbyImage(inputBuffer) {
  const image = await prepareImage(inputBuffer)
  const { data, info } = await sharp(image.buffer)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const detected = findPlayerColorSquares(data, info)
  const squares = inferFirstRows(detected, image.height)

  if (process.env.WC3_OCR_DEBUG === '1') {
    console.log('[wc3-ocr] squares', JSON.stringify(squares))
  }

  if (!squares.length) {
    return {
      names: [],
      width: image.width,
      height: image.height
    }
  }

  const rawNames = await recognizeRows(image, squares)

  return {
    names: dedupeNames(rawNames),
    width: image.width,
    height: image.height
  }
}

module.exports = {
  scanLobbyImage
}
