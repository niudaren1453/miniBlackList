<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import BlacklistView from './views/BlacklistView.vue'

const { locale } = useI18n({ useScope: 'global' })

const elementLocale = computed(() =>
  locale.value === 'zh-CN' ? zhCn : en
)
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <BlacklistView />
  </el-config-provider>
</template>
