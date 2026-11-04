<template>
  <div>
    <a-textarea
      v-model:value="sourceText"
      :disabled="loading"
      placeholder="粘贴阅读 3.0 导出的书源 JSON（支持单个书源或书源数组）"
      :auto-size="{ minRows: 8, maxRows: 12 }"
      class="mb-10"
    />
    <a-alert v-if="error" class="mb-10" type="error" show-icon :message="error" />
    <template v-if="conversions.length">
      <a-alert
        class="mb-10"
        type="info"
        show-icon
        :message="`已转换 ${conversions.length} 条书源；复杂 JavaScript、详情页和图片解密规则可能需要手动调整。`"
      />
      <div class="mb-10 max-h-180 overflow-auto">
        <div v-for="(conversion, index) in conversions" :key="conversion.rule.id" class="mb-8">
          <div class="font-600">{{ conversion.rule.name || `未命名书源 ${index + 1}` }}</div>
          <div v-for="warning in conversion.warnings" :key="warning" class="text-12 op-70">- {{ warning }}</div>
        </div>
      </div>
    </template>
    <div class="flex justify-end gap-8">
      <a-button :disabled="!canConvert || loading" @click="convert">转换</a-button>
      <a-button type="primary" :disabled="!conversions.length" :loading="loading" @click="importConverted">转换并导入</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { App } from 'ant-design-vue';
import { convertLegadoRules } from '@any-reader/rule-utils';
import { createRule as saveRule } from '@/api';

const emit = defineEmits<{
  done: [count: number, failures: string[]];
}>();
const { message } = App.useApp();

const sourceText = ref('');
const conversions = ref<ReturnType<typeof convertLegadoRules>>([]);
const error = ref('');
const loading = ref(false);
const canConvert = computed(() => sourceText.value.trim().length > 0);

watch(sourceText, () => {
  conversions.value = [];
  error.value = '';
});

function convert() {
  try {
    conversions.value = convertLegadoRules(sourceText.value);
    error.value = '';
  } catch (reason) {
    conversions.value = [];
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

async function importConverted() {
  loading.value = true;
  const failures: string[] = [];
  let count = 0;
  for (const { rule } of conversions.value) {
    try {
      const result = await saveRule(rule);
      if (result?.code === 0) {
        count++;
      } else {
        failures.push(`${rule.name || '未命名书源'}：${result?.msg || `错误码 ${result?.code ?? '未知'}`}`);
      }
    } catch (reason) {
      console.error(`导入书源失败：${rule.name}`, reason);
      failures.push(`${rule.name || '未命名书源'}：${reason instanceof Error ? reason.message : String(reason)}`);
    }
  }
  loading.value = false;

  if (failures.length) {
    const failureMessage = `导入失败（${failures.join('、')}）`;
    if (count) {
      emit('done', count, failures);
    } else {
      message.error(failureMessage);
    }
    return;
  }

  emit('done', count, []);
}
</script>
