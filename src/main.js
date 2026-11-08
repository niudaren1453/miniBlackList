import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import i18n, { initializeDocumentLocale } from './i18n'
import './styles/index.scss'

const app = createApp(App)

app.use(ElementPlus)
app.use(i18n)
initializeDocumentLocale()
app.mount('#app')
