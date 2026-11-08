'use strict'

/**
 * 黑名单匹配使用的归一化：全角转半角、去零宽字符、合并空格、忽略大小写。
 */
function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * 用于容错比较的紧凑形式，忽略空格、标点等装饰字符。
 * 例如 "solt....." 与 "solt" 会得到相同的 compact 值。
 */
function compactName(value) {
  return normalizeName(value).replace(/[^\p{L}\p{N}]+/gu, '')
}

function levenshtein(left, right) {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1]

    for (let j = 0; j < right.length; j += 1) {
      const insert = current[j] + 1
      const remove = previous[j + 1] + 1
      const replace = previous[j] + (left[i] === right[j] ? 0 : 1)
      current.push(Math.min(insert, remove, replace))
    }

    previous = current
  }

  return previous[right.length]
}

function fuzzyScore(candidate, recordName) {
  const a = compactName(candidate)
  const b = compactName(recordName)

  if (a.length < 4 || b.length < 4) {
    return null
  }

  const maxLength = Math.max(a.length, b.length)
  const distance = levenshtein(a, b)
  const maxDistance = maxLength <= 6 ? 1 : 2
  const similarity = 1 - distance / maxLength

  if (distance > maxDistance || similarity < 0.82) {
    return null
  }

  return {
    distance,
    similarity
  }
}

function matchVariant(detectedName, activeRecords) {
  const normalized = normalizeName(detectedName)
  const compact = compactName(detectedName)

  if (!normalized) {
    return { matches: [], matchType: null, similarity: 0 }
  }

  const exact = []
  const normalizedMatches = []
  let bestFuzzy = null

  for (const record of activeRecords) {
    const recordNormalized = normalizeName(record.name)
    const recordCompact = compactName(record.name)

    if (normalized === recordNormalized) {
      exact.push(record)
      continue
    }

    if (compact.length >= 2 && compact === recordCompact) {
      normalizedMatches.push(record)
      continue
    }

    const score = fuzzyScore(detectedName, record.name)
    if (
      score &&
      (!bestFuzzy || score.similarity > bestFuzzy.score.similarity)
    ) {
      bestFuzzy = { record, score }
    }
  }

  if (exact.length) {
    return { matches: exact, matchType: 'exact', similarity: 1 }
  }

  if (normalizedMatches.length) {
    return {
      matches: normalizedMatches,
      matchType: 'normalized',
      similarity: 1
    }
  }

  if (bestFuzzy) {
    return {
      matches: [bestFuzzy.record],
      matchType: 'fuzzy',
      similarity: bestFuzzy.score.similarity
    }
  }

  return { matches: [], matchType: null, similarity: 0 }
}

/**
 * 针对 OCR 结果和黑名单记录做匹配。
 * 优先精确匹配，其次忽略标点/空格，最后才使用长度受限的模糊匹配。
 */
function matchNames(detectedNames, records) {
  const activeRecords = (Array.isArray(records) ? records : []).filter(
    (record) => record && record.isDeleted !== true
  )

  const bestByRecordId = new Map()
  const priority = { exact: 3, normalized: 2, fuzzy: 1 }

  for (const recognizedText of detectedNames) {
    const fullName = String(recognizedText ?? '').trim()
    if (!fullName) continue

    // OCR 有时会在名字前带上短噪声（例如 "CC SANGUINIUS"）。
    // 除完整名称外，也把其中长度足够的单词作为候选，避免漏匹配。
    const variants = [
      fullName,
      ...fullName
        .split(/\s+/)
        .filter((part) => part.length >= 4 && part !== fullName)
    ]

    for (const variant of [...new Set(variants)]) {
      const result = matchVariant(variant, activeRecords)

      for (const record of result.matches) {
        const item = {
          detectedName: variant,
          recognizedText: fullName,
          matchType: result.matchType,
          similarity: Number(result.similarity.toFixed(3)),
          blacklist: {
            id: record.id,
            name: record.name,
            map: record.map,
            reason: record.reason,
            addTime: record.addTime
          }
        }

        const current = bestByRecordId.get(String(record.id))
        if (
          !current ||
          priority[item.matchType] > priority[current.matchType] ||
          (priority[item.matchType] === priority[current.matchType] &&
            item.similarity > current.similarity)
        ) {
          bestByRecordId.set(String(record.id), item)
        }
      }
    }
  }

  return [...bestByRecordId.values()].sort(
    (a, b) => priority[b.matchType] - priority[a.matchType]
  )
}

module.exports = {
  normalizeName,
  compactName,
  matchNames
}
