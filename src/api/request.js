import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

function notifyError(message) {
  ElMessage.error({
    message: message || '请求失败，请稍后重试',
    grouping: true
  })
}

request.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (!payload || typeof payload !== 'object') {
      notifyError('响应数据格式异常')
      return Promise.reject(new Error('响应数据格式异常'))
    }

    if (payload.code === 0) {
      return payload.data
    }

    notifyError(payload.msg)
    return Promise.reject(new Error(payload.msg || '请求失败'))
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    let message = '请求失败，请稍后重试'

    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      message = '请求超时，请稍后重试'
    } else if (error.response) {
      message =
        error.response.data?.msg ||
        `请求失败（HTTP ${error.response.status}）`
    } else if (!error.response) {
      message = '网络异常，请确认后端服务已启动'
    }

    notifyError(message)
    return Promise.reject(error)
  }
)

export default request
