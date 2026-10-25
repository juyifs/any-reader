<template>
  <div class="py-10">
    <SettingRow title="过滤标签">
      <div class="w-full">
        <div class="mb-5 text-[--vscode-descriptionForeground]">
          小说正文中匹配规则的段落将被隐藏。普通关键词不区分大小写，也可使用 /正则/flags 指定标志。
        </div>
        <div class="mb-5 flex gap-5">
          <vscode-text-field
            :value="newFilter"
            class="flex-1"
            placeholder="关键词或正则表达式"
            @input="(event) => (newFilter = event.target.value)"
            @keydown.enter.prevent="addFilter"
          />
          <vscode-button @click="addFilter">添加</vscode-button>
        </div>
        <div v-for="(filter, index) in settingStore.data.contentFilters" :key="`${filter}-${index}`" class="mb-5 flex items-center gap-8">
          <code class="flex-1 break-all">{{ filter }}</code>
          <span v-if="getContentFilterError(filter)" class="text-red-500">正则无效：{{ getContentFilterError(filter) }}</span>
          <vscode-button @click="removeFilter(index)">删除</vscode-button>
        </div>
      </div>
    </SettingRow>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { useSettingStore } from '@/stores/setting';
import { getContentFilterError } from '@/utils/contentFilter';
import SettingRow from '../SettingRow/index.vue';

const settingStore = useSettingStore();
const newFilter = ref('');

function addFilter() {
  const pattern = newFilter.value.trim();
  if (!pattern) return;
  const error = getContentFilterError(pattern);
  if (error) {
    message.error(`无效的正则表达式：${error}`);
    return;
  }
  if (settingStore.data.contentFilters.includes(pattern)) {
    message.warning('该过滤规则已存在');
    return;
  }
  settingStore.data.contentFilters.push(pattern);
  newFilter.value = '';
}

function removeFilter(index: number) {
  settingStore.data.contentFilters.splice(index, 1);
}
</script>
