'use strict'

const Koa = require('koa')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')

const blacklistRouter = require('./routes/blacklist')

const app = new Koa()

app.use(cors())

app.use(async (ctx, next) => {
  try {
    await next()

    if (ctx.status === 404 && ctx.body === undefined) {
      ctx.status = 404
      ctx.body = {
        code: 404,
        data: null,
        msg: '接口不存在'
      }
    }
  } catch (error) {
    const status = Number(error.status || error.statusCode) || 500
    const isJsonParseError =
      error instanceof SyntaxError || error.type === 'entity.parse.failed'
    const message = isJsonParseError
      ? '请求体 JSON 格式错误'
      : status >= 500
        ? '服务器内部错误'
        : error.message || '请求失败'

    ctx.status = status
    ctx.body = {
      code: status,
      data: null,
      msg: message
    }

    if (status >= 500) {
      console.error('[blacklist-server]', error)
    }
  }
})

app.use(bodyParser({ enableTypes: ['json'] }))

app.use(blacklistRouter.routes())
app.use(blacklistRouter.allowedMethods({ throw: true }))

module.exports = app
