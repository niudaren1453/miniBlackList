'use strict'

const { HttpError } = require('./errors')

const FIELD_LABELS = {
  name: '姓名/名称',
  map: '所属区域/地图',
  reason: '加入黑名单原因'
}

/**
 * 校验并清理文本字段：去首尾空格后长度必须在 1 - maxLength 之间。
 */
function normalizeText(value, field, maxLength) {
  const label = FIELD_LABELS[field]

  if (typeof value !== 'string') {
    throw new HttpError(400, `${label}必须为字符串`)
  }

  const text = value.trim()

  if (text.length === 0) {
    throw new HttpError(400, `${label}不能为空`)
  }

  if (text.length > maxLength) {
    throw new HttpError(400, `${label}长度不能超过 ${maxLength} 个字符`)
  }

  return text
}

/**
 * 新增 / 修改接口的请求体校验。
 */
function parseBlacklistPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '请求体必须为 JSON 对象')
  }

  return {
    name: normalizeText(body.name, 'name', 50),
    map: normalizeText(body.map, 'map', 50),
    reason: normalizeText(body.reason, 'reason', 200)
  }
}

function parsePositiveInteger(value, field, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const text = String(value).trim()

  if (!/^\d+$/.test(text) || Number(text) < 1) {
    throw new HttpError(400, `${field} 必须为正整数`)
  }

  return Number(text)
}

/**
 * 分页参数校验，默认 page=1、pageSize=10。
 */
function parsePagination(query) {
  return {
    page: parsePositiveInteger(query.page, 'page', 1),
    pageSize: parsePositiveInteger(query.pageSize, 'pageSize', 10)
  }
}

/**
 * 查询参数统一转为去空格的小写字符串，便于模糊匹配。
 */
function normalizeQueryText(value) {
  if (value === undefined || value === null) {
    return ''
  }

  const raw = Array.isArray(value) ? value[0] : value
  return String(raw ?? '').trim().toLowerCase()
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i

/**
 * 解析前端上传的 data URL，限制图片大小并返回 Buffer。
 */
function parseImageDataUrl(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '请求体必须为 JSON 对象')
  }

  if (typeof body.image !== 'string' || !body.image.trim()) {
    throw new HttpError(400, '请上传 WC3 大厅截图')
  }

  const match = IMAGE_DATA_URL_PATTERN.exec(body.image.trim())

  if (!match) {
    throw new HttpError(
      400,
      '图片格式无效，请上传 PNG、JPG 或 WebP 的 data URL'
    )
  }

  const base64 = match[2].replace(/\s/g, '')

  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new HttpError(400, '图片 Base64 数据无效')
  }

  // 先按 Base64 长度预估，避免解码超大请求。
  if (base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) {
    throw new HttpError(413, '图片大小不能超过 8MB')
  }

  const buffer = Buffer.from(base64, 'base64')

  if (!buffer.length) {
    throw new HttpError(400, '图片内容为空')
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, '图片大小不能超过 8MB')
  }

  return buffer
}

/**
 * 解析前端提交的玩家名数组（用于 OCR 结果修正后重新匹配）。
 */
function parseNameListPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '请求体必须为 JSON 对象')
  }

  if (!Array.isArray(body.names)) {
    throw new HttpError(400, 'names 必须为字符串数组')
  }

  if (body.names.length === 0) {
    throw new HttpError(400, '请至少提供一个玩家名')
  }

  if (body.names.length > 32) {
    throw new HttpError(400, '单次最多匹配 32 个玩家名')
  }

  const result = []
  const seen = new Set()

  for (const item of body.names) {
    if (typeof item !== 'string') {
      throw new HttpError(400, '玩家名必须为字符串')
    }

    const name = item.trim()

    if (!name) {
      throw new HttpError(400, '玩家名不能为空')
    }

    if (name.length > 50) {
      throw new HttpError(400, '玩家名长度不能超过 50 个字符')
    }

    const key = name.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      result.push(name)
    }
  }

  return result
}

module.exports = {
  normalizeText,
  parseBlacklistPayload,
  parsePagination,
  normalizeQueryText,
  parseImageDataUrl,
  parseNameListPayload
}
