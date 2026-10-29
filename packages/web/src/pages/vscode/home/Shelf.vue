<template>
  <div class="h-full w-full flex flex-col">
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <vscode-progress-ring></vscode-progress-ring>
    </div>
    <div v-else class="flex-1 overflow-auto">
      <div v-if="errorMessage" class="mx-8 my-4">{{ errorMessage }}</div>
      <TreeItem
        v-for="item in list"
        :key="`${item.type}:${item.ruleId || ''}:${item.url}`"
        :title="item.name"
        class="reader-node"
        @click="showChapter(item)"
      >
        <div class="flex items-center">
          <div class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap" :title="item.name">{{ item.name }}</div>
          <div v-if="item.type === 'favorite'" class="codicon codicon-close" title="取消收藏" @click.stop="remove(item)"></div>
        </div>
      </TreeItem>
    </div>

    <vscode-divider />
    <div class="mx-8 my-4 flex items-center hover:op-70" :class="[openDirLoading ? 'cursor-wait' : 'cursor-pointer']" @click="handleOpenDir">
      <i class="codicon codicon-folder-opened mr-2"></i>
      打开本地目录
    </div>
    <vscode-divider />
  </div>
</template>

<script setup>
import { getFavorites, getLocalBooks } from '@/api';
import { openDir } from '@/api/modules/bookshelf';
import { unstar as removeFavorite } from '@/api/modules/resource-favorites';
import TreeItem from '@/components/vsc/TreeItem.vue';

const router = useRouter();
const list = ref([]);
const loading = ref(false);
const openDirLoading = ref(false);
const errorMessage = ref('');

async function getBookList() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [localResult, favoriteResult] = await Promise.all([getLocalBooks(), getFavorites()]);
    if (localResult?.code !== 0 || favoriteResult?.code !== 0) {
      errorMessage.value = localResult?.msg || favoriteResult?.msg || '无法加载书架';
      return;
    }
    const localBooks = localResult.data || [];
    const favoriteBooks = favoriteResult.data || [];
    list.value = [
      ...localBooks.map((item) => ({ ...item, url: item.path, type: 'local' })),
      ...favoriteBooks.map((item) => ({ ...item, type: 'favorite' }))
    ];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

async function handleOpenDir() {
  if (openDirLoading.value) return;
  openDirLoading.value = true;
  await openDir().catch(() => {});
  openDirLoading.value = false;
}

async function remove(item) {
  await removeFavorite({ url: item.url, ruleId: item.ruleId });
  await getBookList();
}

function showChapter(item) {
  router.push({
    path: '/chapter',
    query: {
      filePath: item.url,
      name: item.name,
      ruleId: item.ruleId || ''
    }
  });
}

getBookList();
</script>

<style scss>
.reader-node:hover {
  .codicon-close {
    display: block;
  }
}

.codicon-close {
  display: none;
  cursor: pointer;
}
</style>
