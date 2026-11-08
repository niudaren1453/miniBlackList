<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { EditPen, Plus } from '@element-plus/icons-vue'

import { createBlacklist, updateBlacklist } from '../api/blacklist'

const emit = defineEmits(['saved'])

const dialogVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formRef = ref(null)

const form = reactive({
  name: '',
  map: '',
  reason: ''
})

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

function resetForm() {
  form.name = ''
  form.map = ''
  form.reason = ''
}

function openCreate() {
  isEdit.value = false
  editingId.value = ''
  resetForm()
  dialogVisible.value = true

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

function openEdit(row) {
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
  const mode = isEdit.value ? 'update' : 'create'

  submitting.value = true

  try {
    if (mode === 'update') {
      await updateBlacklist(editingId.value, payload)
      ElMessage.success('修改成功')
    } else {
      await createBlacklist(payload)
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    emit('saved', { mode })
  } catch (error) {
    // 请求错误已由 request.js 的响应拦截器统一 Toast 提示。
  } finally {
    submitting.value = false
  }
}

defineExpose({
  openCreate,
  openEdit
})
</script>

<template>
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
</template>

<style scoped lang="scss">
@use '../styles/dialogs' as dialog;

@include dialog.heading;

.blacklist-form {
  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 7px;
    color: #334155;
    font-weight: 600;
    font-size: 13px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner) {
    border-radius: 9px;
    box-shadow: 0 0 0 1px #e2e8f0 inset;
  }

  :deep(.el-input__wrapper:hover),
  :deep(.el-textarea__inner:hover) {
    box-shadow: 0 0 0 1px #c7d2fe inset;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-textarea__inner:focus) {
    box-shadow: 0 0 0 1px #6366f1 inset;
  }
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

  em {
    color: #ef4444;
    font-style: normal;
  }
}

@media (max-width: 620px) {
  .dialog-footer {
    align-items: stretch;
    flex-direction: column-reverse;
    gap: 12px;

    > div {
      display: flex;
    }

    .el-button {
      flex: 1;
    }
  }

  .required-hint {
    text-align: center;
  }
}
</style>
