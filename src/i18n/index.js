import { createI18n } from 'vue-i18n'

import enUS from './locales/en-US'
import zhCN from './locales/zh-CN'

export const DEFAULT_LOCALE = 'en-US'
export const SUPPORTED_LOCALES = ['en-US', 'zh-CN']

const STORAGE_KEY = 'blacklist-locale'

function readStoredLocale() {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LOCALES.includes(stored) ? stored : DEFAULT_LOCALE
  } catch (error) {
    return DEFAULT_LOCALE
  }
}

const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN
  }
})

export function setLocale(nextLocale) {
  if (!SUPPORTED_LOCALES.includes(nextLocale)) {
    return
  }

  i18n.global.locale.value = nextLocale

  try {
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
  } catch (error) {
    // 浏览器禁用本地存储时仍允许当前会话内切换语言。
  }

  document.documentElement.lang = nextLocale
  document.title = i18n.global.t('app.title')
}

export function initializeDocumentLocale() {
  document.documentElement.lang = i18n.global.locale.value
  document.title = i18n.global.t('app.title')
}

export default i18n
