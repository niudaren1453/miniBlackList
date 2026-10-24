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

module.exports = {
  normalizeText,
  parseBlacklistPayload,
  parsePagination,
  normalizeQueryText
}
