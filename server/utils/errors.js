'use strict'

/**
 * 带 HTTP 状态码的业务异常，交由 app.js 的统一错误中间件处理。
 */
class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.expose = true
  }
}

module.exports = { HttpError }
