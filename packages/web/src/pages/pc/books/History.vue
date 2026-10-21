<template>
  <div class="mb-10 w-full flex justify-end">
    <a-popconfirm title="确定清空全部阅读历史吗？" ok-text="清空" cancel-text="取消" @confirm="clearHistory">
      <a-button danger :disabled="clearing || !historyStore.list.length">清空历史</a-button>
    </a-popconfirm>
  </div>
  <Book
    v-for="item in historyStore.list"
    :key="item.url"
    :cover="item.cover"
    :name="item.name"
    :author="item.author"
    :description="item.description"
    class="mb-10 mr-10"
    :file-path="item.url"
    :rule-id="item.ruleId"
  />
</template>

<script setup>
import { App } from 'ant-design-vue';
import { getHistory, removeHistory } from '@/api';
import { useHistoryStore } from '@/stores/history';
import Book from './Book.vue';

const { message } = App.useApp();
const historyStore = useHistoryStore();
const clearing = ref(false);

historyStore.sync();

async function clearHistory() {
  clearing.value = true;
  let total = 0;

  try {
    let res = await getHistory();
    if (res?.code !== 0) throw new Error(res?.msg || '读取历史失败');

    let rows = res.data || [];
    while (rows.length) {
      const results = await Promise.all(rows.map(({ ruleId, url }) => removeHistory({ ruleId, url })));
      if (results.some((result) => result?.code !== 0)) throw new Error('删除历史失败');

      total += rows.length;
      res = await getHistory();
      if (res?.code !== 0) throw new Error(res?.msg || '读取历史失败');
      rows = res.data || [];
      historyStore.list = rows;
    }

    message.success({ content: `已清空 ${total} 条阅读历史` });
  } catch (error) {
    message.error({ content: error?.message || '清空历史失败，请重试' });
    await historyStore.sync();
  } finally {
    clearing.value = false;
  }
}
</script>
