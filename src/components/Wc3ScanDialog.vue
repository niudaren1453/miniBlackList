<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Camera,
  CircleCheckFilled,
  Loading,
  UploadFilled,
  WarningFilled
} from '@element-plus/icons-vue'

import {
  matchBlacklistNames,
  scanBlacklistImage
} from '../api/blacklist'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const scanUploadRef = ref(null)
const scanFile = ref(null)
const scanPreviewUrl = ref('')
const scanLoading = ref(false)
const scanRematching = ref(false)
const scanError = ref('')
const scanResult = ref(null)
const scanNamesText = ref('')

const hasScanMatches = computed(
  () => (scanResult.value?.matches?.length || 0) > 0
)

const matchedNameKeys = computed(() => {
  const keys = new Set()

  for (const match of scanResult.value?.matches || []) {
    for (const value of [match.detectedName, match.recognizedText]) {
      if (value) keys.add(String(value).trim().toLowerCase())
    }
  }

  return keys
})

const SCAN_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const SCAN_MAX_BYTES = 8 * 1024 * 1024

function releaseScanPreview() {
  if (scanPreviewUrl.value) {
    URL.revokeObjectURL(scanPreviewUrl.value)
    scanPreviewUrl.value = ''
  }
}

function resetScanDialog() {
  releaseScanPreview()
  scanFile.value = null
  scanResult.value = null
  scanError.value = ''
  scanNamesText.value = ''
  scanLoading.value = false
  scanRematching.value = false
  scanUploadRef.value?.clearFiles()
}

function handleClosed() {
  resetScanDialog()
}

function clearScanFile() {
  resetScanDialog()
}

function handleScanFileChange(uploadFile) {
  const file = uploadFile?.raw

  if (!file) return

  if (!SCAN_IMAGE_TYPES.includes(file.type)) {
    ElMessage.error('仅支持 PNG、JPG、WebP 格式的图片')
    scanUploadRef.value?.clearFiles()
    return
  }

  if (file.size > SCAN_MAX_BYTES) {
    ElMessage.error('图片大小不能超过 8MB')
    scanUploadRef.value?.clearFiles()
    return
  }

  releaseScanPreview()
  scanFile.value = file
  scanPreviewUrl.value = URL.createObjectURL(file)
  scanResult.value = null
  scanError.value = ''
  scanNamesText.value = ''
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function normalizeScanResult(data) {
  const names = Array.isArray(data?.names)
    ? data.names
        .filter(
          (item) => item && typeof item.name === 'string' && item.name.trim()
        )
        .map((item) => ({
          name: item.name.trim(),
          confidence: Number(item.confidence) || 0,
          source: item.source || 'player'
        }))
    : []

  const matches = Array.isArray(data?.matches) ? data.matches : []

  return {
    names,
    matches,
    summary: {
      recognizedCount: names.length,
      matchedCount: matches.length
    }
  }
}

async function handleScan() {
  if (!scanFile.value || scanLoading.value) return

  scanLoading.value = true
  scanError.value = ''
  scanResult.value = null

  try {
    const dataUrl = await fileToDataUrl(scanFile.value)
    const data = await scanBlacklistImage(dataUrl)
    const normalized = normalizeScanResult(data)

    scanResult.value = normalized
    scanNamesText.value = normalized.names.map((item) => item.name).join('\n')

    if (normalized.matches.length) {
      ElMessage.warning(`检测到 ${normalized.matches.length} 条黑名单命中`)
    } else if (normalized.names.length) {
      ElMessage.success(
        `识别到 ${normalized.names.length} 个名称，未命中黑名单`
      )
    } else {
      ElMessage.warning('没有识别到玩家名，请尝试更清晰的大厅截图')
    }
  } catch (error) {
    scanError.value = '截图识别失败，请更换清晰的 WC3 大厅截图后重试。'
  } finally {
    scanLoading.value = false
  }
}

function isNameMatched(name) {
  return matchedNameKeys.value.has(String(name ?? '').trim().toLowerCase())
}

function sameName(left, right) {
  return (
    String(left ?? '').trim().toLowerCase() ===
    String(right ?? '').trim().toLowerCase()
  )
}

function matchTypeLabel(type) {
  return (
    {
      exact: '精确命中',
      normalized: '忽略标点',
      fuzzy: '模糊命中'
    }[type] || '已命中'
  )
}

function matchTypeTag(type) {
  return (
    {
      exact: 'danger',
      normalized: 'warning',
      fuzzy: 'info'
    }[type] || 'danger'
  )
}

async function handleRematch() {
  if (scanRematching.value) return

  const seen = new Set()
  const names = scanNamesText.value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter((name) => {
      if (!name) return false
      const key = name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!names.length) {
    ElMessage.warning('请至少填写一个玩家名')
    return
  }

  if (names.length > 32) {
    ElMessage.warning('单次最多匹配 32 个玩家名')
    return
  }

  if (names.some((name) => name.length > 50)) {
    ElMessage.warning('单个玩家名不能超过 50 个字符')
    return
  }

  const previousByName = new Map(
    (scanResult.value?.names || []).map((item) => [
      item.name.trim().toLowerCase(),
      item
    ])
  )

  scanRematching.value = true

  try {
    const data = await matchBlacklistNames(names)
    const matches = Array.isArray(data?.matches) ? data.matches : []
    const nextNames = names.map((name) => {
      return (
        previousByName.get(name.toLowerCase()) || {
          name,
          confidence: null,
          source: 'manual'
        }
      )
    })

    scanResult.value = {
      ...(scanResult.value || {}),
      names: nextNames,
      matches,
      summary: {
        recognizedCount: nextNames.length,
        matchedCount: matches.length
      }
    }
    scanNamesText.value = names.join('\n')

    if (matches.length) {
      ElMessage.warning(`重新匹配完成，发现 ${matches.length} 条命中`)
    } else {
      ElMessage.success('重新匹配完成，未命中黑名单')
    }
  } catch (error) {
    // 请求错误已由 request.js 的响应拦截器统一 Toast 提示。
  } finally {
    scanRematching.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetScanDialog()
  }
)
</script>

<template>
  <el-dialog
    v-model="visible"
    class="blacklist-dialog scan-dialog"
    width="820px"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="!scanLoading"
    :show-close="!scanLoading"
    @closed="handleClosed"
  >
    <template #header>
      <div class="dialog-heading">
        <div class="dialog-icon scan-dialog-icon">
          <el-icon :size="20"><Camera /></el-icon>
        </div>
        <div>
          <h3>WC3 大厅截图检测</h3>
          <p>上传大厅截图，自动识别玩家名并比对黑名单。</p>
        </div>
      </div>
    </template>

    <div class="scan-dialog-body">
      <el-upload
        v-if="!scanFile"
        ref="scanUploadRef"
        class="scan-uploader"
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept="image/png,image/jpeg,image/webp"
        :on-change="handleScanFileChange"
      >
        <div class="scan-dropzone">
          <div class="scan-drop-icon">
            <el-icon :size="30"><UploadFilled /></el-icon>
          </div>
          <p>拖拽 WC3 大厅截图到这里，或 <em>点击选择</em></p>
          <span>支持 PNG / JPG / WebP，单张不超过 8MB</span>
        </div>
      </el-upload>

      <div v-else class="scan-preview-wrap">
        <img
          :src="scanPreviewUrl"
          class="scan-preview"
          alt="WC3 大厅截图预览"
        />
        <div class="scan-preview-edge">
          <span class="scan-file-name">{{ scanFile.name }}</span>
          <el-button
            link
            type="primary"
            :disabled="scanLoading"
            @click="clearScanFile"
          >
            重新选择
          </el-button>
        </div>

        <div v-if="scanLoading" class="scan-loading-mask">
          <div class="scan-spinner">
            <el-icon class="is-loading" :size="28"><Loading /></el-icon>
          </div>
          <strong>正在识别大厅玩家…</strong>
          <span>首次识别需要加载 OCR 模型，请稍候</span>
        </div>
      </div>

      <div v-if="scanError" class="scan-error">
        <el-icon :size="16"><WarningFilled /></el-icon>
        <span>{{ scanError }}</span>
      </div>

      <div v-if="scanResult" class="scan-result">
        <div class="scan-summary" :class="{ 'has-hit': hasScanMatches }">
          <div class="scan-summary-icon">
            <el-icon :size="23">
              <WarningFilled v-if="hasScanMatches" />
              <CircleCheckFilled v-else />
            </el-icon>
          </div>
          <div class="scan-summary-copy">
            <strong>
              {{
                hasScanMatches
                  ? `发现 ${scanResult.matches.length} 条黑名单命中`
                  : '未命中黑名单'
              }}
            </strong>
            <p>
              已识别 {{ scanResult.names.length }} 个大厅名称，可在下方修正后重新匹配。
            </p>
          </div>
        </div>

        <section class="scan-section">
          <h4>识别到的名称</h4>
          <div v-if="scanResult.names.length" class="scan-name-list">
            <span
              v-for="(item, index) in scanResult.names"
              :key="`${item.name}-${index}`"
              class="scan-name-chip"
              :class="{ hit: isNameMatched(item.name) }"
            >
              <span class="scan-name-dot"></span>
              {{ item.name }}
              <em v-if="item.source === 'host'">房主</em>
            </span>
          </div>
          <p v-else class="scan-empty">
            没有识别到玩家名，请在下方手动补充后重新匹配。
          </p>
        </section>

        <section v-if="hasScanMatches" class="scan-section">
          <h4>黑名单命中</h4>
          <article
            v-for="match in scanResult.matches"
            :key="match.blacklist.id"
            class="scan-match-card"
          >
            <div class="scan-match-head">
              <div class="scan-match-title">
                <span class="scan-match-name">
                  {{ match.blacklist.name }}
                </span>
                <span
                  v-if="!sameName(match.detectedName, match.blacklist.name)"
                  class="scan-match-ocr"
                >
                  识别为 {{ match.detectedName }}
                </span>
              </div>
              <el-tag
                size="small"
                effect="light"
                :type="matchTypeTag(match.matchType)"
              >
                {{ matchTypeLabel(match.matchType) }}
              </el-tag>
            </div>

            <div class="scan-match-meta">
              <span>地图：{{ match.blacklist.map }}</span>
              <span>记录时间：{{ match.blacklist.addTime }}</span>
            </div>

            <p class="scan-match-reason">{{ match.blacklist.reason }}</p>
          </article>
        </section>

        <section class="scan-section scan-manual">
          <div class="scan-section-title">
            <div>
              <h4>修正识别名单</h4>
              <p>每行一个玩家名，识别有误时可修改后重新匹配。</p>
            </div>
            <el-button
              type="primary"
              plain
              :loading="scanRematching"
              @click="handleRematch"
            >
              重新匹配
            </el-button>
          </div>
          <el-input
            v-model="scanNamesText"
            type="textarea"
            :rows="4"
            resize="none"
            placeholder="每行输入一个玩家名"
          />
        </section>
      </div>
    </div>

    <template #footer>
      <div class="scan-footer">
        <span class="scan-footer-tip">
          截图仅用于本次识别，不会写入磁盘。
        </span>
        <div class="scan-footer-actions">
          <el-button :disabled="scanLoading" @click="visible = false">
            关闭
          </el-button>
          <el-button
            v-if="!scanResult"
            type="primary"
            :loading="scanLoading"
            :disabled="!scanFile"
            @click="handleScan"
          >
            识别并匹配
          </el-button>
          <el-button
            v-else
            type="primary"
            :disabled="scanLoading"
            @click="clearScanFile"
          >
            换一张
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use '../styles/dialogs' as dialog;

@include dialog.heading;

.scan-dialog-icon {
  color: #0f766e;
  background: #ecfdf5;
}

.scan-dialog-body {
  max-height: 68vh;
  overflow-y: auto;
  padding: 2px;
  scrollbar-gutter: stable;
}

.scan-uploader {
  display: block;
  width: 100%;

  :deep(.el-upload) {
    display: block;
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    padding: 0;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.1), transparent 55%),
      #f8faff;
    border: 1.5px dashed #c7d2fe;
    border-radius: 16px;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }

  :deep(.el-upload-dragger:hover) {
    background:
      radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.14), transparent 55%),
      #f5f7ff;
    border-color: #818cf8;
  }
}

.scan-dropzone {
  padding: 38px 24px 34px;
  text-align: center;

  p {
    margin: 0 0 7px;
    color: #334155;
    font-weight: 600;
    font-size: 14px;

    em {
      color: #4f46e5;
      font-style: normal;
    }
  }

  > span {
    color: #94a3b8;
    font-size: 12px;
  }
}

.scan-drop-icon {
  display: grid;
  width: 62px;
  height: 62px;
  margin: 0 auto 14px;
  color: #6366f1;
  background: #fff;
  border: 1px solid #e0e7ff;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.1);
  place-items: center;
}

.scan-preview-wrap {
  position: relative;
  overflow: hidden;
  background: #0b1120;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.scan-preview {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
}

.scan-preview-edge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 13px;
  background: #fff;
  border-top: 1px solid #eef2f7;
}

.scan-file-name {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 20px;
  color: #fff;
  text-align: center;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(5px);

  strong {
    font-size: 15px;
  }

  span {
    color: #cbd5e1;
    font-size: 12px;
  }
}

.scan-spinner {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 4px;
  color: #c7d2fe;
  background: rgba(99, 102, 241, 0.25);
  border: 1px solid rgba(199, 210, 254, 0.35);
  border-radius: 18px;
  place-items: center;
}

.scan-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 11px 13px;
  color: #b91c1c;
  font-size: 13px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.scan-result {
  margin-top: 18px;
}

.scan-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 14px;

  &.has-hit {
    color: #9f1239;
    background: #fff1f2;
    border-color: #fecdd3;
  }
}

.scan-summary-icon {
  display: grid;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 12px;
  place-items: center;
}

.scan-summary-copy {
  strong {
    display: block;
    margin-bottom: 3px;
    font-size: 15px;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.55;
  }
}

.scan-section {
  margin-top: 20px;

  h4 {
    margin: 0 0 10px;
    color: #334155;
    font-weight: 700;
    font-size: 13px;
  }
}

.scan-name-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scan-name-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 6px 10px;
  color: #475569;
  font-size: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  word-break: break-all;

  &.hit {
    color: #b91c1c;
    background: #fef2f2;
    border-color: #fecaca;

    .scan-name-dot {
      background: #ef4444;
    }
  }

  em {
    padding: 1px 5px;
    color: #4338ca;
    font-style: normal;
    font-size: 10px;
    background: #eef2ff;
    border-radius: 4px;
  }
}

.scan-name-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  background: #94a3b8;
  border-radius: 50%;
}

.scan-empty {
  margin: 0;
  padding: 13px 15px;
  color: #64748b;
  font-size: 12px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
}

.scan-match-card {
  padding: 15px;
  background: #fff;
  border: 1px solid #fee2e2;
  border-left: 3px solid #ef4444;
  border-radius: 12px;

  + .scan-match-card {
    margin-top: 10px;
  }
}

.scan-match-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.scan-match-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.scan-match-name {
  color: #991b1b;
  font-weight: 700;
  font-size: 15px;
  word-break: break-all;
}

.scan-match-ocr {
  color: #94a3b8;
  font-size: 11px;
}

.scan-match-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 7px;
  color: #64748b;
  font-size: 11px;
}

.scan-match-reason {
  margin: 10px 0 0;
  padding-top: 10px;
  color: #475569;
  font-size: 13px;
  line-height: 1.65;
  border-top: 1px dashed #f1f5f9;
  white-space: pre-wrap;
}

.scan-manual {
  padding-top: 18px;
  border-top: 1px solid #eef2f7;

  :deep(.el-textarea__inner) {
    border-radius: 10px;
    box-shadow: 0 0 0 1px #e2e8f0 inset;
  }

  :deep(.el-textarea__inner:focus) {
    box-shadow: 0 0 0 1px #6366f1 inset;
  }
}

.scan-section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;

  h4 {
    margin-bottom: 3px;
  }

  p {
    margin: 0;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.5;
  }
}

.scan-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.scan-footer-tip {
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.5;
}

.scan-footer-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

@media (max-width: 620px) {
  .scan-dialog-body {
    max-height: 62vh;
  }

  .scan-dropzone {
    padding: 28px 16px 26px;
  }

  .scan-preview {
    max-height: 230px;
  }

  .scan-summary {
    align-items: flex-start;
    padding: 13px;
  }

  .scan-section-title {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;

    .el-button {
      align-self: flex-start;
    }
  }

  .scan-match-head {
    flex-direction: column;
    gap: 8px;
  }

  .scan-match-meta {
    flex-direction: column;
    gap: 4px;
  }

  .scan-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .scan-footer-tip {
    text-align: center;
  }

  .scan-footer-actions .el-button {
    flex: 1;
  }
}
</style>
