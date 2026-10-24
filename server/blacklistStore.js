'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const AsyncLock = require('async-lock')

const { HttpError } = require('./utils/errors')

const DATA_FILE = path.join(__dirname, '..', 'data', 'blacklist.json')
const LOCK_KEY = 'blacklist-file'
const fileLock = new AsyncLock()

/**
 * 首次启动时自动创建 data 目录与空数据文件。
 */
async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })

  try {
    await fs.access(DATA_FILE)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    await fs.writeFile(DATA_FILE, '[]\n', 'utf8')
  }
}

async function readRecords() {
  await ensureDataFile()
  const raw = await fs.readFile(DATA_FILE, 'utf8')
  const content = raw.replace(/^\uFEFF/, '').trim()

  let records
  try {
    records = content ? JSON.parse(content) : []
  } catch (error) {
    throw new Error(`黑名单数据文件不是合法 JSON：${DATA_FILE}`)
  }

  if (!Array.isArray(records)) {
    throw new Error(`黑名单数据文件必须为 JSON 数组：${DATA_FILE}`)
  }

  return records
}

async function writeRecords(records) {
  // 先写临时文件再重命名，尽量避免进程中断造成半截 JSON。
  const tempFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`
  const content = `${JSON.stringify(records, null, 2)}\n`

  try {
    await fs.writeFile(tempFile, content, 'utf8')
    await fs.rename(tempFile, DATA_FILE)
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => {})
  }
}

function getNextId(records) {
  const maxId = records.reduce((max, record) => {
    const id = String(record?.id ?? '')
    if (!/^\d+$/.test(id)) {
      return max
    }
    return Math.max(max, Number(id))
  }, 0)

  return String(maxId + 1)
}

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ')
}

/**
 * 读取全部记录（包含软删除记录），供查询接口自行过滤和排序。
 */
async function listRecords() {
  return fileLock.acquire(LOCK_KEY, () => readRecords())
}

/**
 * 新增记录，自增字符串 id 从全部记录（含已软删）的最大数字 id 递增。
 */
async function createRecord({ name, map, reason }) {
  return fileLock.acquire(LOCK_KEY, async () => {
    const records = await readRecords()
    const record = {
      id: getNextId(records),
      name,
      map,
      reason,
      addTime: formatDateTime(),
      isDeleted: false
    }

    records.push(record)
    await writeRecords(records)

    return record
  })
}

/**
 * 修改未删除记录，仅允许更新 name、map、reason。
 */
async function updateRecord(id, { name, map, reason }) {
  return fileLock.acquire(LOCK_KEY, async () => {
    const records = await readRecords()
    const index = records.findIndex(
      (record) => String(record.id) === String(id) && record.isDeleted !== true
    )

    if (index === -1) {
      throw new HttpError(404, '记录不存在或已删除')
    }

    const updated = {
      ...records[index],
      name,
      map,
      reason
    }

    records[index] = updated
    await writeRecords(records)

    return updated
  })
}

/**
 * 软删除：仅把 isDeleted 置为 true，不物理移除记录。
 */
async function softDeleteRecord(id) {
  return fileLock.acquire(LOCK_KEY, async () => {
    const records = await readRecords()
    const index = records.findIndex(
      (record) => String(record.id) === String(id) && record.isDeleted !== true
    )

    if (index === -1) {
      throw new HttpError(404, '记录不存在或已删除')
    }

    records[index] = {
      ...records[index],
      isDeleted: true
    }

    await writeRecords(records)

    return records[index]
  })
}

module.exports = {
  DATA_FILE,
  listRecords,
  createRecord,
  updateRecord,
  softDeleteRecord
}
