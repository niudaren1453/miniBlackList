<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { EditPen, Plus } from '@element-plus/icons-vue'

import { createBlacklist, updateBlacklist } from '../api/blacklist'

const emit = defineEmits(['saved'])
const { t } = useI18n({ useScope: 'global' })

const dialogVisible = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formRef = ref(null)

const form = reactive({
  listType: 'black',
  name: '',
  map: '',
  reason: ''
})

const dialogTitle = computed(() =>
  t(isEdit.value ? 'form.editTitle' : 'form.createTitle')
)

const dialogSubtitle = computed(() =>
  t(isEdit.value ? 'form.editSubtitle' : 'form.createSubtitle')
)

function createTextValidator(labelKey, maxLength, requiredKey) {
  return (_rule, value, callback) => {
    const text = typeof value === 'string' ? value.trim() : ''

    if (!text) {
      callback(new Error(t(requiredKey)))
      return
    }

    if (text.length > maxLength) {
      callback(
        new Error(
          t('form.validation.maxLength', {
            label: t(labelKey),
            max: maxLength
          })
        )
      )
      return
    }

    callback()
  }
}

const rules = {
  name: [
    {
      validator: createTextValidator(
        'form.nameField',
        50,
        'form.validation.nameRequired'
      ),
      trigger: 'blur'
    }
  ],
  map: [
    {
      validator: createTextValidator(
        'form.mapField',
        50,
        'form.validation.mapRequired'
      ),
      trigger: 'blur'
    }
  ],
  reason: [
    {
      validator: createTextValidator(
        'form.reasonField',
        200,
        'form.validation.reasonRequired'
      ),
      trigger: 'blur'
    }
  ]
}

function resetForm() {
  form.listType = 'black'
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
  form.listType = row.listType === 'white' ? 'white' : 'black'
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
    listType: form.listType,
    name: form.name.trim(),
    map: form.map.trim(),
    reason: form.reason.trim()
  }
  const mode = isEdit.value ? 'update' : 'create'

  submitting.value = true

  try {
    if (mode === 'update') {
      await updateBlacklist(editingId.value, payload)
      ElMessage.success(t('form.updateSuccess'))
    } else {
      await createBlacklist(payload)
      ElMessage.success(t('form.createSuccess'))
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
      <el-form-item
        :label="t('form.listTypeLabel')"
        prop="listType"
        required
      >
        <div
          class="list-type-picker"
          role="radiogroup"
          :aria-label="t('form.listTypeLabel')"
        >
          <button
            type="button"
            class="list-type-option black"
            :class="{ 'is-active': form.listType === 'black' }"
            role="radio"
            :aria-checked="form.listType === 'black'"
            @click="form.listType = 'black'"
          >
            <span class="type-option-marker"></span>
            <span class="type-option-text">
              <strong>{{ t('type.black') }}</strong>
              <small>{{ t('form.blacklistHint') }}</small>
            </span>
            <span
              v-if="form.listType === 'black'"
              class="type-option-check"
              aria-hidden="true"
            >
              ✓
            </span>
          </button>

          <button
            type="button"
            class="list-type-option white"
            :class="{ 'is-active': form.listType === 'white' }"
            role="radio"
            :aria-checked="form.listType === 'white'"
            @click="form.listType = 'white'"
          >
            <span class="type-option-marker"></span>
            <span class="type-option-text">
              <strong>{{ t('type.white') }}</strong>
              <small>{{ t('form.whitelistHint') }}</small>
            </span>
            <span
              v-if="form.listType === 'white'"
              class="type-option-check"
              aria-hidden="true"
            >
              ✓
            </span>
          </button>
        </div>
      </el-form-item>

      <el-form-item :label="t('form.nameLabel')" prop="name" required>
        <el-input
          v-model="form.name"
          :placeholder="t('form.namePlaceholder')"
          maxlength="50"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-form-item :label="t('form.mapLabel')" prop="map" required>
        <el-input
          v-model="form.map"
          :placeholder="t('form.mapPlaceholder')"
          maxlength="50"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-form-item :label="t('form.reasonLabel')" prop="reason" required>
        <el-input
          v-model="form.reason"
          type="textarea"
          :placeholder="t('form.reasonPlaceholder')"
          :rows="4"
          maxlength="200"
          show-word-limit
          resize="none"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <span class="required-hint">
          <em>*</em> {{ t('form.requiredHint') }}
        </span>
        <div>
          <el-button :disabled="submitting" @click="dialogVisible = false">
            {{ t('form.cancel') }}
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleSubmit"
          >
            {{ isEdit ? t('form.save') : t('form.create') }}
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

.list-type-picker {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.list-type-option {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  padding: 12px;
  color: #334155;
  text-align: left;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
  }

  &:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 1px;
  }

  &.black.is-active {
    background: #fff7f7;
    border-color: #fca5a5;
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.08);
  }

  &.white.is-active {
    background: #f0fdf4;
    border-color: #86efac;
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.08);
  }

  &.black .type-option-marker {
    background: #ef4444;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
  }

  &.white .type-option-marker {
    background: #10b981;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
  }
}

.type-option-marker {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 50%;
}

.type-option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  strong {
    color: #1e293b;
    font-weight: 700;
    font-size: 13px;
  }

  small {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.45;
  }
}

.type-option-check {
  flex: 0 0 auto;
  color: #4f46e5;
  font-weight: 700;
  font-size: 13px;
}

.black.is-active .type-option-check {
  color: #dc2626;
}

.white.is-active .type-option-check {
  color: #059669;
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
  .list-type-picker {
    grid-template-columns: minmax(0, 1fr);
  }

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
