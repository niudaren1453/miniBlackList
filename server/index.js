'use strict'

const app = require('./app')

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
  console.log(`[blacklist-server] API 已启动：http://127.0.0.1:${port}/api`)
})
