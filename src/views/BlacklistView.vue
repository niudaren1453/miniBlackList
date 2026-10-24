<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref
} from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  Document,
  EditPen,
  Location,
  Lock,
  Plus,
  Refresh,
  Search
} from '@element-plus/icons-vue'

import {
  createBlacklist,
  deleteBlacklist,
  getBlacklistList,
  updateBlacklist
} from '../api/blacklist'

const PAGE_SIZE = 10

const records = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const filters = reactive({ name: '', map: '' })

const dialogVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formRef = ref(null)
const deletingId = ref(null)

const form = reactive({
  name: '',
  map: '',
  reason: ''
})

const hasFilters = computed(
  () => Boolean(filters.name.trim()) || Boolean(filters.map.trim())
)

const dialogTitle = computed(() =>
  isEdit.value ? '编辑黑名单' : '新增黑名单'
)

const dialogSubtitle = computed(() =>
  isEdit.value
    ? '修改姓名、地图或加入黑名单的原因。'
    : '请填写完整信息，ID 与添加时间将由系统自动生成。'
)

function createTextValidator(label, maxLength) {
  return (_rule, value, callback) => {
    const text = typeof value === 'string' ? value.trim() : ''

    if (!text) {
      callback(new Error(`请输入${label}`))
      return
    }

    if (text.length > maxLength) {
      callback(new Error(`${label}长度不能超过 ${maxLength} 个字符`))
      return
    }

    callback()
  }
}

const rules = {
  name: [
    {
      validator: createTextValidator('姓名/名称', 50),
      trigger: 'blur'
    }
  ],
  map: [
    {
      validator: createTextValidator('地图名称', 50),
      trigger: 'blur'
    }
  ],
  reason: [
    {
      validator: createTextValidator('加入黑名单原因', 200),
      trigger: 'blur'
    }
  ]
}

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

function resetForm() {
  form.name = ''
  form.map = ''
  form.reason = ''
}

function openCreateDialog() {
  isEdit.value = false
  editingId.value = ''
  resetForm()
  dialogVisible.value = true

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

function openEditDialog(row) {
  isEdit.value = true
  editingId.value = row.id
  form.name = row.name
  form.map = row.map
  form.reason = row.reason
  dialogVisible.value = true

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

function handleDialogClosed() {
  resetForm()
  editingId.value = ''
  isEdit.value = false
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  const payload = {
    name: form.name.trim(),
    map: form.map.trim(),
    reason: form.reason.trim()
  }

  submitting.value = true

  try {
    if (isEdit.value) {
      await updateBlacklist(editingId.value, payload)
      ElMessage.success('修改成功')
    } else {
      await createBlacklist(payload)
      ElMessage.success('新增成功')
      page.value = 1
    }

    dialogVisible.value = false
    await fetchList()
  } catch (error) {
    // 请求错误已由 request.js 的响应拦截器统一 Toast 提示。
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${row.name}」吗？删除后该记录将不再显示在列表中。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        closeOnClickModal: false
      }
    )
  } catch (error) {
    return
  }

  deletingId.value = row.id

  try {
    await deleteBlacklist(row.id)
    ElMessage.success('删除成功')

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
            <p class="eyebrow">Blacklist console</p>
            <h1>黑名单管理</h1>
            <!-- <p class="subtitle">
                
              统一维护违规人员与所属地图，支持检索、编辑和软删除。
            </p> -->
          </div>
        </div>

        <div class="total-pill" aria-live="polite">
          <span class="pulse-dot"></span>
          <span>当前共 <strong>{{ total }}</strong> 条记录</span>
        </div>
      </header>

      <main class="content-card">
        <section class="toolbar" aria-label="筛选与新增">
          <div class="filter-group">
            <el-input
              v-model="filters.name"
              class="filter-input"
              placeholder="搜索姓名/名称"
              clearable
              :prefix-icon="Search"
              @input="scheduleSearch"
              @clear="scheduleSearch"
              @keyup.enter="handleSearchNow"
            />
            <el-input
              v-model="filters.map"
              class="filter-input"
              placeholder="搜索地图"
              clearable
              :prefix-icon="Search"
              @input="scheduleSearch"
              @clear="scheduleSearch"
              @keyup.enter="handleSearchNow"
            />
            <el-button type="primary" :icon="Search" @click="handleSearchNow">
              查询
            </el-button>
            <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          </div>

          <div class="toolbar-actions">
            <el-button
              type="primary"
              class="add-button"
              :icon="Plus"
              @click="openCreateDialog"
            >
              新增黑名单
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
            <el-table-column prop="id" label="ID" width="88">
              <template #default="{ row }">
                <span class="id-badge">#{{ row.id }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="姓名 / 名称" width="170">
              <template #default="{ row }">
                <div class="name-cell">
                  <span
                    class="name-avatar"
                    :class="avatarTone(row.id)"
                    aria-hidden="true"
                  >
                    {{ getInitial(row.name) }}
                  </span>
                  <span class="name-text">{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column
              prop="map"
              label="地图"
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
              label="加入黑名单原因"
              min-width="280"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="reason-text">{{ row.reason }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="addTime" label="添加时间" width="176">
              <template #default="{ row }">
                <span class="time-text">{{ row.addTime }}</span>
              </template>
            </el-table-column>

            <el-table-column
              label="操作"
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
                  编辑
                </el-button>
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  :loading="deletingId === row.id"
                  @click="handleDelete(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <div class="empty-state">
                <div class="empty-icon">
                  <el-icon :size="24"><Document /></el-icon>
                </div>
                <p>暂无黑名单记录</p>
                <span>
                  {{
                    hasFilters
                      ? '没有找到匹配结果，试试调整筛选条件'
                      : '点击“新增黑名单”添加第一条记录'
                  }}
                </span>
              </div>
            </template>
          </el-table>
        </div>

        <footer class="table-footer">
          <span class="table-hint">
            <span class="hint-dot"></span>
            仅展示未删除记录 · 按添加时间倒序
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

    <el-dialog
      v-model="dialogVisible"
      class="blacklist-dialog"
      width="540px"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
      @closed="handleDialogClosed"
    >
      <template #header>
        <div class="dialog-heading">
          <div class="dialog-icon">
            <el-icon :size="20">
              <EditPen v-if="isEdit" />
              <Plus v-else />
            </el-icon>
          </div>
          <div>
            <h3>{{ dialogTitle }}</h3>
            <p>{{ dialogSubtitle }}</p>
          </div>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="blacklist-form"
        @submit.prevent
      >
        <el-form-item label="姓名 / 名称" prop="name" required>
          <el-input
            v-model="form.name"
            placeholder="请输入姓名或名称"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>

        <el-form-item label="地图" prop="map" required>
          <el-input
            v-model="form.map"
            placeholder="请手动输入地图"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>

        <el-form-item label="加入黑名单原因" prop="reason" required>
          <el-input
            v-model="form.reason"
            type="textarea"
            placeholder="请说明加入黑名单的原因"
            :rows="4"
            maxlength="200"
            show-word-limit
            resize="none"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <span class="required-hint"><em>*</em> 为必填项</span>
          <div>
            <el-button :disabled="submitting" @click="dialogVisible = false">
              取消
            </el-button>
            <el-button
              type="primary"
              :loading="submitting"
              @click="handleSubmit"
            >
              {{ isEdit ? '保存修改' : '确认新增' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
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

.toolbar-actions {
  flex: 0 0 auto;
}

.add-button {
  box-shadow: 0 7px 15px rgba(79, 70, 229, 0.2);
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

.name-text {
  overflow: hidden;
  color: #1e293b;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.dialog-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  padding-right: 24px;
}

.dialog-icon {
  display: grid;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  color: #4f46e5;
  background: #eef2ff;
  border-radius: 12px;
  place-items: center;
}

.dialog-heading h3 {
  margin: 0;
  color: #0f172a;
  font-weight: 700;
  font-size: 19px;
  line-height: 1.35;
}

.dialog-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.blacklist-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.blacklist-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: #334155;
  font-weight: 600;
  font-size: 13px;
}

.blacklist-form :deep(.el-input__wrapper),
.blacklist-form :deep(.el-textarea__inner) {
  border-radius: 9px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
}

.blacklist-form :deep(.el-input__wrapper:hover),
.blacklist-form :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px #c7d2fe inset;
}

.blacklist-form :deep(.el-input__wrapper.is-focus),
.blacklist-form :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #6366f1 inset;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.required-hint {
  color: #94a3b8;
  font-size: 12px;
}

.required-hint em {
  color: #ef4444;
  font-style: normal;
}

@media (max-width: 860px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
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

  .toolbar-actions {
    width: 100%;
  }

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
    margin-left: 61px;
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

  .dialog-footer {
    align-items: stretch;
    flex-direction: column-reverse;
    gap: 12px;
  }

  .dialog-footer > div {
    display: flex;
  }

  .dialog-footer .el-button {
    flex: 1;
  }

  .required-hint {
    text-align: center;
  }
}
</style>
