<template>
  <div v-if="!list.length" class="h-full w-full flex items-center justify-center">
    <a-empty description="书架为空，可在设置中配置本地书籍目录，或收藏书源中的书籍" />
  </div>
  <template v-else>
    <Book
      v-for="item in list"
      :key="`${item.type}:${item.ruleId || ''}:${item.url}`"
      :cover="item.cover"
      :name="item.name"
      :description="item.description"
      :file-path="item.url"
      :rule-id="item.ruleId"
      :author="item.author"
      class="node mb-10 mr-10"
    >
      <a-button class="edit-book invisible absolute right-5 top-5" size="small" title="编辑书籍信息" @click.stop="openEditor(item)">
        <EditOutlined />
      </a-button>
      <a-button
        v-if="item.type === 'favorite'"
        class="star invisible absolute right-5 top-40"
        size="small"
        title="取消收藏"
        @click.stop="favoritesStore.unstar({ url: item.url, ruleId: item.ruleId })"
      >
        <StarFilled :size="14" />
      </a-button>
    </Book>
  </template>

  <a-modal v-model:open="editorOpen" title="编辑书籍信息" :confirm-loading="saving" @ok="saveMetadata">
    <a-form layout="vertical">
      <a-form-item label="书名">
        <a-input v-model:value="editForm.name" placeholder="请输入书名" />
      </a-form-item>
      <a-form-item label="作者">
        <a-input v-model:value="editForm.author" placeholder="请输入作者" />
      </a-form-item>
      <a-form-item label="封面 URL">
        <a-input v-model:value="editForm.cover" placeholder="请输入封面图片 URL" />
      </a-form-item>
      <a-form-item label="简介">
        <a-textarea v-model:value="editForm.description" :auto-size="{ minRows: 3, maxRows: 8 }" placeholder="请输入简介" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { App } from 'ant-design-vue';
import { getLocalBooks, updateBookMetadata } from '@/api';
import { useFavoritesStore } from '@/stores/favorites';
import Book from './Book.vue';

const { message } = App.useApp();
const favoritesStore = useFavoritesStore();
const localList = ref([]);
const editorOpen = ref(false);
const saving = ref(false);
const currentBook = ref(null);
const editForm = reactive({
  name: '',
  author: '',
  cover: '',
  description: ''
});
const list = computed(() => [
  ...localList.value.map((item) => ({ ...item, url: item.path, type: 'local' })),
  ...favoritesStore.list.map((item) => ({ ...item, type: 'favorite' }))
]);

async function loadLocalBooks() {
  const res = await getLocalBooks();
  if (res?.code === 0) localList.value = res.data || [];
}

function openEditor(item) {
  currentBook.value = item;
  Object.assign(editForm, {
    name: item.name || '',
    author: item.author || '',
    cover: item.cover || '',
    description: item.description || ''
  });
  editorOpen.value = true;
}

async function saveMetadata() {
  if (!currentBook.value || saving.value) return;
  saving.value = true;
  try {
    const result = await updateBookMetadata({
      ruleId: currentBook.value.ruleId || '',
      url: currentBook.value.url,
      ...editForm
    });
    if (result?.code !== 0) throw new Error(result?.msg || '保存书籍信息失败');
    if (currentBook.value.type === 'local') {
      localList.value = localList.value.map((book) => (book.path === currentBook.value.url ? { ...book, ...editForm } : book));
    } else {
      favoritesStore.list = favoritesStore.list.map((book) =>
        book.ruleId === (currentBook.value.ruleId || '') && book.url === currentBook.value.url ? { ...book, ...editForm } : book
      );
    }
    editorOpen.value = false;
    message.success('书籍信息已保存，并同步到当前 AnyReader 服务');
  } catch (error) {
    message.error(error?.msg || error?.message || '保存书籍信息失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadLocalBooks();
  await favoritesStore.sync();
});
</script>

<style lang="scss">
.star,
.edit-book {
  visibility: visible;
}

@media (hover: hover) and (pointer: fine) {
  .star,
  .edit-book {
    visibility: hidden;
  }

  .node:hover {
    .star,
    .edit-book {
      visibility: visible;
    }

    .cover {
      transform: scale(1.2);
    }
  }
}
</style>
