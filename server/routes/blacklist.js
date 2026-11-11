'use strict'

const Router = require('@koa/router')

const {
  listRecords,
  createRecord,
  updateRecord,
  softDeleteRecord
} = require('../blacklistStore')
const {
  parseBlacklistPayload,
  parseListTypeFilter,
  parsePagination,
  normalizeQueryText,
  parseImageDataUrl,
  parseNameListPayload
} = require('../utils/validation')
const { scanLobbyImage } = require('../services/wc3Scan')
const { matchNames } = require('../services/blacklistMatcher')

const router = new Router({ prefix: '/api' })

/**
 * GET /api/blacklist?name=&map=&listType=&page=1&pageSize=10
 * name 与 map 之间为 OR 关系、大小写不敏感；为空则忽略该条件。
 * listType 为空或 all 时查询全部，black / white 时按名单类型过滤。
 */
router.get('/blacklist', async (ctx) => {
  const { page, pageSize } = parsePagination(ctx.query)
  const nameKeyword = normalizeQueryText(ctx.query.name)
  const mapKeyword = normalizeQueryText(ctx.query.map)
  const listTypeFilter = parseListTypeFilter(ctx.query.listType)

  const records = await listRecords()
  const filtered = records
    .filter((record) => record && record.isDeleted !== true)
    .filter(
      (record) =>
        !listTypeFilter || (record.listType || 'black') === listTypeFilter
    )
    .filter((record) => {
      if (!nameKeyword && !mapKeyword) {
        return true
      }

      const nameMatched =
        Boolean(nameKeyword) &&
        String(record.name ?? '')
          .toLowerCase()
          .includes(nameKeyword)

      const mapMatched =
        Boolean(mapKeyword) &&
        String(record.map ?? '')
          .toLowerCase()
          .includes(mapKeyword)

      return nameMatched || mapMatched
    })
    .sort((a, b) => {
      const byAddTime = String(b.addTime ?? '').localeCompare(
        String(a.addTime ?? '')
      )

      if (byAddTime !== 0) {
        return byAddTime
      }

      // 同一秒新增时，用较大的 id 优先，保证顺序稳定。
      return Number(b.id) - Number(a.id)
    })

  const total = filtered.length
  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  ctx.body = {
    code: 0,
    data: { list, total, page, pageSize },
    msg: 'success'
  }
})

/**
 * POST /api/blacklist/scan
 * 上传 WC3 大厅截图，OCR 出玩家名并返回白名单 / 黑名单命中结果。
 */
router.post('/blacklist/scan', async (ctx) => {
  const imageBuffer = parseImageDataUrl(ctx.request.body)
  const scan = await scanLobbyImage(imageBuffer)
  const records = await listRecords()
  const matches = matchNames(
    scan.names.map((item) => item.name),
    records
  )
  const blackMatchedCount = matches.filter(
    (item) => item.record.listType === 'black'
  ).length
  const whiteMatchedCount = matches.filter(
    (item) => item.record.listType === 'white'
  ).length

  ctx.body = {
    code: 0,
    data: {
      ...scan,
      matches,
      summary: {
        recognizedCount: scan.names.length,
        matchedCount: matches.length,
        blackMatchedCount,
        whiteMatchedCount
      }
    },
    msg: 'success'
  }
})

/**
 * POST /api/blacklist/match
 * 对 OCR 结果修正后的玩家名重新做名单匹配。
 */
router.post('/blacklist/match', async (ctx) => {
  const names = parseNameListPayload(ctx.request.body)
  const records = await listRecords()
  const matches = matchNames(names, records)
  const blackMatchedCount = matches.filter(
    (item) => item.record.listType === 'black'
  ).length
  const whiteMatchedCount = matches.filter(
    (item) => item.record.listType === 'white'
  ).length

  ctx.body = {
    code: 0,
    data: {
      names,
      matches,
      summary: {
        recognizedCount: names.length,
        matchedCount: matches.length,
        blackMatchedCount,
        whiteMatchedCount
      }
    },
    msg: 'success'
  }
})

/**
 * POST /api/blacklist
 */
router.post('/blacklist', async (ctx) => {
  const payload = parseBlacklistPayload(ctx.request.body)
  const record = await createRecord(payload)

  ctx.body = {
    code: 0,
    data: record,
    msg: 'success'
  }
})

/**
 * PUT /api/blacklist/:id
 */
router.put('/blacklist/:id', async (ctx) => {
  const payload = parseBlacklistPayload(ctx.request.body)
  const record = await updateRecord(ctx.params.id, payload)

  ctx.body = {
    code: 0,
    data: record,
    msg: 'success'
  }
})

/**
 * DELETE /api/blacklist/:id —— 软删除
 */
router.delete('/blacklist/:id', async (ctx) => {
  const record = await softDeleteRecord(ctx.params.id)

  ctx.body = {
    code: 0,
    data: record,
    msg: 'success'
  }
})

module.exports = router
