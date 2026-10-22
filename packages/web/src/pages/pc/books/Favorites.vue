<template>
  <Book
    v-for="item in favoritesStore.list"
    :key="item.url"
    :cover="item.cover"
    :name="item.name"
    :description="item.description"
    :file-path="item.url"
    :rule-id="item.ruleId"
    :author="item.author"
    :click-handler="() => openFavorite(item)"
    class="node mb-10 mr-10"
  >
    <div
      class="star invisible absolute right-5 top-5 flex items-center justify-center rounded-10 px-2 py-2 text-[--ar-color-text]"
      @click.stop="favoritesStore.unstar({ url: item.url, ruleId: item.ruleId })"
    >
      <StarFilled v-if="favoritesStore.starred(item)" :size="14" />
      <StarOutlined v-else :size="14" />
    </div>
  </Book>
</template>

<script setup>
import { App } from 'ant-design-vue';
import { ContentType } from '@any-reader/rule-utils';
import { getChapter, getChapterHistorys } from '@/api';
import { useFavoritesStore } from '@/stores/favorites';
import { useRulesStore } from '@/stores/rules';
import Book from './Book.vue';

const { message } = App.useApp();
const router = useRouter();
const favoritesStore = useFavoritesStore();
const rulesStore = useRulesStore();
const openingFavorite = ref('');

onMounted(() => {
  favoritesStore.sync();
});

function openChapterList(item) {
  router.push({
    path: '/chapter',
    query: {
      filePath: item.url,
      ruleId: item.ruleId,
      name: item.name,
      cover: item.cover,
      author: item.author,
      description: item.description
    }
  });
}

async function openFavorite(item) {
  const rule = rulesStore.list.find((row) => row.id === item.ruleId);
  if (!rule || (rule.contentType !== ContentType.NOVEL && rule.contentType !== ContentType.MANGA)) {
    openChapterList(item);
    return;
  }

  const key = `${item.ruleId}:${item.url}`;
  if (openingFavorite.value === key) return;
  openingFavorite.value = key;

  try {
    const historyRes = await getChapterHistorys({ ruleId: item.ruleId, filePath: item.url });
    if (historyRes?.code !== 0) {
      message.warning('读取阅读记录失败，将打开章节列表');
      openChapterList(item);
      return;
    }

    const history = historyRes.data?.[0];
    if (!history?.chapterPath) {
      openChapterList(item);
      return;
    }

    const chaptersRes = await getChapter(item.url, item.ruleId);
    if (chaptersRes?.code !== 0) {
      message.warning('读取章节目录失败，将打开章节列表');
      openChapterList(item);
      return;
    }

    const chapterExists = (chaptersRes.data || []).some((chapter) => (chapter.chapterPath || chapter.url) === history.chapterPath);
    if (!chapterExists) {
      openChapterList(item);
      return;
    }

    router.push({
      path: '/content',
      query: {
        filePath: item.url,
        ruleId: item.ruleId,
        chapterPath: history.chapterPath,
        percentage: history.percentage || 0
      }
    });
  } catch (error) {
    message.warning(error instanceof Error ? `${error.message}，将打开章节列表` : '读取阅读记录失败，将打开章节列表');
    openChapterList(item);
  } finally {
    openingFavorite.value = '';
  }
}
</script>

<style lang="scss">
.node:hover {
  .star {
    visibility: visible;
    &:hover {
      background: rgba(0, 0, 0, 1);
    }
  }

  .cover {
    transform: scale(1.2);
  }
}
</style>
