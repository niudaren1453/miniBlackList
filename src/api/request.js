import axios from 'axios'
import { ElMessage } from 'element-plus'

import i18n from '../i18n'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

function t(key, params) {
  return i18n.global.t(key, params)
}

function statusMessage(status) {
  if (status === 400) return t('request.invalid')
  if (status === 404) return t('request.notFound')
  if (status === 405) return t('request.methodNotAllowed')
  if (status === 413) return t('request.tooLarge')
  if (status === 422) return t('request.ocrFailed')
  if (status >= 500) return t('request.serverError')
  return t('request.failed')
}

function resolveErrorMessage(code, serverMessage) {
  if (i18n.global.locale.value === 'zh-CN' && serverMessage) {
    return serverMessage
  }

  return statusMessage(Number(code))
}

function notifyError(message) {
  ElMessage.error({
    message: message || t('request.failed'),
    grouping: true
  })
}

request.interceptors.response.use(
  (response) => {
    const payload = response.data

    if (!payload || typeof payload !== 'object') {
      const message = t('request.invalidResponse')
      notifyError(message)
      return Promise.reject(new Error(message))
    }

    if (payload.code === 0) {
      return payload.data
    }

    const message = resolveErrorMessage(payload.code, payload.msg)
    notifyError(message)
    return Promise.reject(new Error(message))
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    let message = t('request.failed')

    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      message = t('request.timeout')
    } else if (error.response) {
      const status = error.response.status
      const serverMessage = error.response.data?.msg

      if (i18n.global.locale.value === 'zh-CN' && serverMessage) {
        message = serverMessage
      } else if (
        [400, 404, 405, 413, 422].includes(status) ||
        status >= 500
      ) {
        message = statusMessage(status)
      } else {
        message = t('request.http', { status })
      }
    } else {
      message = t('request.network')
    }

    notifyError(message)
    return Promise.reject(error)
  }
)

export default request
