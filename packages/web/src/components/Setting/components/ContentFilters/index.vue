<template>
  <div class="h-full overflow-auto p-10">
    <div class="mb-10 text-[--ar-color-text-secondary]">
      小说正文中匹配以下规则的段落将被隐藏。规则按正则表达式解析；普通关键词不区分大小写，也可使用 /正则/flags 指定标志。
    </div>
    <div class="mb-10 flex gap-5">
      <a-input v-model:value="newFilter" class="max-w-400px" placeholder="输入关键词或正则表达式" @press-enter="addFilter" />
      <a-button type="primary" @click="addFilter">添加</a-button>
    </div>
    <div v-if="settingStore.data.contentFilters.length" class="flex flex-col gap-5">
      <div v-for="(filter, index) in settingStore.data.contentFilters" :key="`${filter}-${index}`" class="flex items-center gap-8">
        <code class="break-all">{{ filter }}</code>
        <span v-if="getContentFilterError(filter)" class="text-red-500">正则无效：{{ getContentFilterError(filter) }}</span>
        <a-button size="small" danger @click="removeFilter(index)">删除</a-button>
      </div>
    </div>
    <div v-else class="text-[--ar-color-text-secondary]">还没有添加过滤规则</div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { useSettingStore } from '@/stores/setting';
import { getContentFilterError } from '@/utils/contentFilter';

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
