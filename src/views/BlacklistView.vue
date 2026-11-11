<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  Camera,
  Delete,
  Document,
  EditPen,
  Location,
  Lock,
  Plus,
  Refresh,
  Search
} from '@element-plus/icons-vue'

import { deleteBlacklist, getBlacklistList } from '../api/blacklist'
import { setLocale } from '../i18n'
import BlacklistFormDialog from '../components/BlacklistFormDialog.vue'
import Wc3ScanDialog from '../components/Wc3ScanDialog.vue'

const { t, locale } = useI18n({ useScope: 'global' })

const languageOptions = [
  {
    value: 'en-US',
    label: 'EN',
    titleKey: 'language.english'
  },
  {
    value: 'zh-CN',
    label: '中文',
    titleKey: 'language.chinese'
  }
]

const PAGE_SIZE = 10

const records = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const filters = reactive({ name: '', map: '', listType: 'all' })

const scanDialogVisible = ref(false)
const formDialogRef = ref(null)
const deletingId = ref(null)

const hasFilters = computed(
  () =>
    Boolean(filters.name.trim()) ||
    Boolean(filters.map.trim()) ||
    filters.listType !== 'all'
)

let searchTimer = null
let latestRequestId = 0

function clearSearchTimer() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

function scheduleSearch() {
  clearSearchTimer()
  searchTimer = setTimeout(() => {
    searchTimer = null
    page.value = 1
    fetchList()
  }, 300)
}

function handleSearchNow() {
  clearSearchTimer()
  page.value = 1
  fetchList()
}

function handleReset() {
  clearSearchTimer()
  filters.name = ''
  filters.map = ''
  filters.listType = 'all'
  page.value = 1
  fetchList()
}

function handleListTypeChange() {
  clearSearchTimer()
  page.value = 1
  fetchList()
}

function handlePageChange(nextPage) {
  page.value = nextPage
  fetchList()
}

async function fetchList() {
  const requestId = ++latestRequestId
  loading.value = true

  try {
    const data = await getBlacklistList({
      name: filters.name.trim(),
      map: filters.map.trim(),
      listType: filters.listType === 'all' ? '' : filters.listType,
      page: page.value,
      pageSize: PAGE_SIZE
    })

    if (requestId !== latestRequestId) {
      return
    }

    records.value = Array.isArray(data?.list) ? data.list : []
    total.value = Number(data?.total) || 0
  } catch (error) {
    if (requestId === latestRequestId) {
      records.value = []
      total.value = 0
    }
  } finally {
    if (requestId === latestRequestId) {
      loading.value = false
    }
  }
}

function openCreateDialog() {
  formDialogRef.value?.openCreate()
}

function openEditDialog(row) {
  formDialogRef.value?.openEdit(row)
}

function openScanDialog() {
  scanDialogVisible.value = true
}

function switchLanguage(nextLocale) {
  setLocale(nextLocale)
}

async function handleDialogSaved({ mode }) {
  if (mode === 'create') {
    page.value = 1
  }

  await fetchList()
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      t('table.deleteConfirm', { name: row.name }),
      t('table.deleteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('table.confirmDelete'),
        cancelButtonText: t('table.cancel'),
        closeOnClickModal: false
      }
    )
  } catch (error) {
    return
  }

  deletingId.value = row.id

  try {
    await deleteBlacklist(row.id)
    ElMessage.success(t('table.deleteSuccess'))

    if (records.value.length === 1 && page.value > 1) {
      page.value -= 1
    }

    await fetchList()
  } catch (error) {
    // 请求错误已由请求拦截器提示。
  } finally {
    deletingId.value = null
  }
}

function getInitial(name) {
  return String(name ?? '').trim().charAt(0).toUpperCase() || '?'
}

function avatarTone(id) {
  const tones = ['tone-violet', 'tone-blue', 'tone-teal', 'tone-amber']
  return tones[Number(id) % tones.length] || tones[0]
}

function listTypeOf(row) {
  return row?.listType === 'white' ? 'white' : 'black'
}

function nameTypeClass(row) {
  return listTypeOf(row) === 'white' ? 'type-white' : 'type-black'
}

onMounted(fetchList)
onBeforeUnmount(clearSearchTimer)
</script>

<template>
  <div class="page-shell">
    <div class="page-container">
      <header class="page-header">
        <div class="brand-area">
          <div class="brand-mark">
            <el-icon :size="27"><Lock /></el-icon>
          </div>
          <div class="brand-copy">
            <p class="eyebrow">{{ t('app.eyebrow') }}</p>
            <h1>{{ t('app.title') }}</h1>
            <!-- <p class="subtitle">
                
              统一维护违规人员与所属地图，支持检索、编辑和软删除。
            </p> -->
          </div>
        </div>

        <div class="header-tools">
          <div class="total-pill" aria-live="polite">
            <span class="pulse-dot"></span>
            <i18n-t keypath="app.totalRecords" tag="span">
              <template #total>
                <strong>{{ total }}</strong>
              </template>
            </i18n-t>
          </div>

          <div
            class="language-switch"
            role="group"
            :aria-label="t('app.languageSwitch')"
          >
            <button
              v-for="option in languageOptions"
              :key="option.value"
              type="button"
              class="language-option"
              :class="{ active: locale === option.value }"
              :title="t(option.titleKey)"
              :aria-pressed="locale === option.value"
              @click="switchLanguage(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </header>

      <main class="content-card">
        <section class="toolbar" :aria-label="t('toolbar.aria')">
          <div class="filter-group">
            <el-input
              v-model="filters.name"
              class="filter-input"
              :placeholder="t('toolbar.searchName')"
              clearable
              :prefix-icon="Search"
              @input="scheduleSearch"
              @clear="scheduleSearch"
              @keyup.enter="handleSearchNow"
            />
            <el-input
              v-model="filters.map"
              class="filter-input"
              :placeholder="t('toolbar.searchMap')"
              clearable
              :prefix-icon="Search"
              @input="scheduleSearch"
              @clear="scheduleSearch"
              @keyup.enter="handleSearchNow"
            />
            <el-select
              v-model="filters.listType"
              class="filter-select"
              :aria-label="t('type.filterLabel')"
              @change="handleListTypeChange"
            >
              <el-option :label="t('type.all')" value="all" />
              <el-option :label="t('type.black')" value="black" />
              <el-option :label="t('type.white')" value="white" />
            </el-select>
            <el-button type="primary" :icon="Search" @click="handleSearchNow">
              {{ t('toolbar.search') }}
            </el-button>
            <el-button :icon="Refresh" @click="handleReset">
              {{ t('toolbar.reset') }}
            </el-button>
          </div>

          <div class="toolbar-actions">
            <el-button
              type="primary"
              class="scan-button"
              :icon="Camera"
              @click="openScanDialog"
            >
              {{ t('toolbar.imageScan') }}
            </el-button>
            <el-button
              type="primary"
              plain
              class="add-button"
              :icon="Plus"
              @click="openCreateDialog"
            >
              {{ t('toolbar.add') }}
            </el-button>
          </div>
        </section>

        <div class="table-wrap">
          <el-table
            v-loading="loading"
            :data="records"
            row-key="id"
            class="record-table"
          >
            <el-table-column prop="id" :label="t('table.id')" width="88">
              <template #default="{ row }">
                <span class="id-badge">#{{ row.id }}</span>
              </template>
            </el-table-column>

            <el-table-column
              prop="name"
              :label="t('table.name')"
              width="170"
            >
              <template #default="{ row }">
                <div class="name-cell">
                  <span
                    class="name-avatar"
                    :class="[avatarTone(row.id), nameTypeClass(row)]"
                    aria-hidden="true"
                  >
                    {{ getInitial(row.name) }}
                  </span>
                  <span class="name-text" :class="nameTypeClass(row)">
                    {{ row.name }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column
              prop="listType"
              :label="t('table.type')"
              width="112"
            >
              <template #default="{ row }">
                <el-tag
                  class="list-type-tag"
                  size="small"
                  effect="light"
                  round
                  :type="listTypeOf(row) === 'white' ? 'success' : 'danger'"
                >
                  {{ t(`type.${listTypeOf(row)}`) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column
              prop="map"
              :label="t('table.map')"
              width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="map-pill" :title="row.map">
                  <span class="map-dot"></span>
                  <span class="map-label">{{ row.map }}</span>
                </span>
              </template>
            </el-table-column>

            <el-table-column
              prop="reason"
              :label="t('table.reason')"
              min-width="280"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="reason-text">{{ row.reason }}</span>
              </template>
            </el-table-column>

            <el-table-column
              prop="addTime"
              :label="t('table.addTime')"
              width="176"
            >
              <template #default="{ row }">
                <span class="time-text">{{ row.addTime }}</span>
              </template>
            </el-table-column>

            <el-table-column
              :label="t('table.actions')"
              width="158"
              fixed="right"
              align="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  :icon="EditPen"
                  @click="openEditDialog(row)"
                >
                  {{ t('table.edit') }}
                </el-button>
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  :loading="deletingId === row.id"
                  @click="handleDelete(row)"
                >
                  {{ t('table.delete') }}
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <div class="empty-state">
                <div class="empty-icon">
                  <el-icon :size="24"><Document /></el-icon>
                </div>
                <p>{{ t('table.empty') }}</p>
                <span>
                  {{
                    hasFilters
                      ? t('table.emptyFiltered')
                      : t('table.emptyHint')
                  }}
                </span>
              </div>
            </template>
          </el-table>
        </div>

        <footer class="table-footer">
          <span class="table-hint">
            <span class="hint-dot"></span>
            {{ t('table.footer') }}
          </span>

          <el-pagination
            v-model:current-page="page"
            :page-size="PAGE_SIZE"
            :total="total"
            :pager-count="5"
            background
            layout="total, prev, pager, next, jumper"
            @current-change="handlePageChange"
          />
        </footer>
      </main>
    </div>

    <BlacklistFormDialog ref="formDialogRef" @saved="handleDialogSaved" />
    <Wc3ScanDialog v-model="scanDialogVisible" />
  </div>
</template>

<style scoped lang="scss">
.page-shell {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  padding: clamp(28px, 4.5vw, 58px) clamp(16px, 4vw, 48px) 48px;
  overflow: hidden;
}

.page-shell::before,
.page-shell::after {
  position: fixed;
  z-index: -1;
  border-radius: 50%;
  content: '';
  pointer-events: none;
  filter: blur(2px);
}

.page-shell::before {
  top: -190px;
  right: -140px;
  width: 460px;
  height: 460px;
  background: radial-gradient(
    circle,
    rgba(99, 102, 241, 0.16) 0%,
    rgba(99, 102, 241, 0) 68%
  );
}

.page-shell::after {
  bottom: -240px;
  left: -180px;
  width: 520px;
  height: 520px;
  background: radial-gradient(
    circle,
    rgba(14, 165, 233, 0.12) 0%,
    rgba(14, 165, 233, 0) 70%
  );
}

.page-container {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.header-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.language-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(12px);
}

.language-option {
  min-width: 38px;
  padding: 6px 9px;
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    color: #4338ca;
  }

  &.active {
    color: #fff;
    background: #4f46e5;
    box-shadow: 0 4px 10px rgba(79, 70, 229, 0.28);
  }

  &:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 1px;
  }
}

.brand-area {
  display: flex;
  align-items: center;
  gap: 18px;
}

.brand-mark {
  display: grid;
  flex: 0 0 auto;
  width: 58px;
  height: 58px;
  color: #fff;
  background: linear-gradient(145deg, #6366f1 0%, #4338ca 62%, #312e81 100%);
  border-radius: 18px;
  box-shadow:
    0 12px 24px rgba(67, 56, 202, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  place-items: center;
}

.eyebrow {
  margin: 0 0 5px;
  color: #6366f1;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.brand-copy h1 {
  margin: 0;
  color: #0f172a;
  font-weight: 700;
  font-size: clamp(25px, 3vw, 31px);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.total-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
  padding: 10px 15px;
  color: #475569;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(12px);
}

.total-pill strong {
  color: #4338ca;
  font-weight: 700;
  font-size: 15px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
}

.content-card {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 22px;
  box-shadow:
    0 22px 55px rgba(15, 23, 42, 0.07),
    0 2px 8px rgba(15, 23, 42, 0.03);
  backdrop-filter: blur(16px);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 22px 24px;
  border-bottom: 1px solid #eef2f7;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-input {
  width: 210px;
}

.filter-select {
  width: 150px;
}

.toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.toolbar-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.scan-button {
  box-shadow: 0 7px 15px rgba(79, 70, 229, 0.2);
}

.add-button {
  background: #fff;
}

.table-wrap {
  padding: 6px 24px 0;
}

.record-table {
  width: 100%;
}

.record-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.record-table :deep(th.el-table__cell) {
  height: 48px;
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  background: #f8fafc;
  border-bottom-color: #edf2f7;
}

.record-table :deep(td.el-table__cell) {
  height: 61px;
  color: #334155;
  border-bottom-color: #f1f5f9;
}

.record-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: #f8faff;
}

.record-table :deep(.el-table__empty-block) {
  min-height: 260px;
}

.id-badge {
  color: #64748b;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 3px 7px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.name-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  color: #4f46e5;
  font-weight: 700;
  font-size: 12px;
  background: #eef2ff;
  border-radius: 9px;
  place-items: center;
}

.name-avatar.tone-blue {
  color: #0369a1;
  background: #e0f2fe;
}

.name-avatar.tone-teal {
  color: #0f766e;
  background: #ccfbf1;
}

.name-avatar.tone-amber {
  color: #b45309;
  background: #fef3c7;
}

.name-avatar.type-black {
  color: #dc2626;
  background: #fef2f2;
}

.name-avatar.type-white {
  color: #059669;
  background: #ecfdf5;
}

.name-text {
  overflow: hidden;
  color: #1e293b;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-text.type-black {
  color: #b91c1c;
}

.name-text.type-white {
  color: #047857;
}

.list-type-tag {
  font-weight: 600;
}

.map-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 9px;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
}

.map-dot {
  flex: 0 0 auto;
  width: 5px;
  height: 5px;
  background: #818cf8;
  border-radius: 50%;
}

.map-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason-text {
  color: #475569;
}

.time-text {
  color: #64748b;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}

.empty-state {
  padding: 30px 0;
  color: #94a3b8;
}

.empty-icon {
  display: grid;
  width: 54px;
  height: 54px;
  margin: 0 auto 12px;
  color: #818cf8;
  background: #eef2ff;
  border-radius: 16px;
  place-items: center;
}

.empty-state p {
  margin: 0 0 6px;
  color: #475569;
  font-weight: 600;
  font-size: 14px;
}

.empty-state span {
  font-size: 12px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px 22px;
}

.table-hint {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #94a3b8;
  font-size: 12px;
  white-space: nowrap;
}

.hint-dot {
  width: 5px;
  height: 5px;
  background: #c7d2fe;
  border-radius: 50%;
}

.table-footer :deep(.el-pagination) {
  --el-pagination-button-bg-color: #f8fafc;
  --el-pagination-hover-color: #4f46e5;
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 860px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .header-tools {
    width: 100%;
    justify-content: space-between;
  }

  .toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
  }

  .filter-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-input {
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }

  .toolbar-actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scan-button,
  .add-button {
    width: 100%;
  }

  .table-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .table-footer :deep(.el-pagination) {
    justify-content: flex-start;
  }
}

@media (max-width: 620px) {
  .page-shell {
    padding: 24px 12px 32px;
  }

  .brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 15px;
  }

  .brand-area {
    align-items: flex-start;
    gap: 13px;
  }

  .subtitle {
    font-size: 13px;
  }

  .total-pill {
    margin-left: 0;
  }

  .header-tools {
    flex-wrap: wrap;
    gap: 10px;
    padding-left: 61px;
  }

  .content-card {
    border-radius: 18px;
  }

  .toolbar {
    padding: 18px 14px;
  }

  .filter-group {
    grid-template-columns: minmax(0, 1fr);
  }

  .table-wrap {
    padding: 4px 12px 0;
  }

  .table-footer {
    padding: 16px 14px 18px;
  }

  .table-footer :deep(.el-pagination__jump) {
    display: none;
  }

  .table-footer :deep(.el-pagination) {
    width: 100%;
    gap: 4px;
  }

}
</style>
