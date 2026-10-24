import request from './request'

/**
 * 查询黑名单列表（后端已过滤 isDeleted 并按 addTime 倒序）。
 */
export function getBlacklistList(params) {
  return request.get('/blacklist', { params })
}

/**
 * 新增黑名单，id、addTime、isDeleted 均由后端生成。
 */
export function createBlacklist(data) {
  return request.post('/blacklist', data)
}

/**
 * 修改黑名单。
 */
export function updateBlacklist(id, data) {
  return request.put(`/blacklist/${encodeURIComponent(id)}`, data)
}

/**
 * 按 id 软删除黑名单。
 */
export function deleteBlacklist(id) {
  return request.delete(`/blacklist/${encodeURIComponent(id)}`)
}
