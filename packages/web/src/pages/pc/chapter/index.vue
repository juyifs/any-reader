<template>
  <div class="h-full flex flex-col gap-10 overflow-hidden p-10 text-[--ar-color-text]">
    <div class="flex shrink-0 gap-10">
      <ARCover
        :src="book.cover"
        error-icon="icon-book"
        :preview="false"
        :alt="book.name"
        srcset=""
        class="h-180px w-135px shrink-0 rounded-5 object-cover"
        width="135px"
        height="180px"
        fit="cover"
      />
      <div class="min-w-0 flex flex-1 flex-col justify-center">
        <div class="mb-8 overflow-hidden text-ellipsis whitespace-nowrap text-20 font-bold" :title="book.name">{{ book.name }}</div>
        <div class="overflow-hidden text-ellipsis whitespace-nowrap text-14 op-70" :title="book.author">{{ book.author }}</div>
      </div>
    </div>

    <div class="flex shrink-0 gap-10">
      <a-button type="primary" class="h-40 flex-1" :disabled="loading || !startChapter" @click="startChapter && showContent(startChapter)">
        {{ isMedia ? '开始播放' : '开始阅读' }}
      </a-button>
      <a-button class="h-40 flex-1" :disabled="!ruleId" @click="star">
        <template #icon>
          <StarFilled v-if="isStarred" />
          <StarOutlined v-else />
        </template>
        {{ isStarred ? '取消收藏' : '收藏' }}
      </a-button>
    </div>

    <div
      v-if="description || book.description"
      class="max-h-120 shrink-0 overflow-auto whitespace-pre-wrap rounded-5 bg-[--ar-chapter-bg] p-10 text-14 lh-22"
    >
      {{ description || book.description }}
    </div>

    <div class="min-h-0 flex flex-1 flex-col">
      <div class="mb-10">
        <a-input v-model:value="searchQuery" placeholder="搜索章节..." allow-clear class="w-full">
          <template #prefix>
            <search-outlined />
          </template>
        </a-input>
      </div>

      <div ref="chaptersRef" class="min-h-0 flex-1 overflow-auto rounded-10 bg-[--ar-chapter-bg] p-10 text-[--ar-color-text-secondary]">
        <a-spin v-if="loading" :spinning="loading" class="h-full w-full items-center justify-center !flex" />
        <template v-else-if="list.length">
          <div
            v-for="item in filteredList"
            :key="item.url"
            class="min-h-32 w-full flex cursor-pointer items-center gap-8 overflow-hidden rounded-2 px-8 hover:bg-[--ar-color-primary-bg] hover:text-[--ar-color-primary-text]"
            :class="[
              isLastRead(item) ? 'text-[--ar-color-primary-text]' : 'text-[--ar-color-text]',
              {
                'op-70': !!findHistory(item)
              }
            ]"
            :data-url="item.chapterPath"
            @click="isVideo ? openOriginalVideo(item) : showContent(item)"
          >
            <div class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap lh-32" :title="item.name">
              {{ item.name }}
            </div>
            <a-button v-if="isVideo" type="link" size="small" class="shrink-0 px-4" @click.stop="showContent(item)"> 内置播放器 </a-button>
          </div>
        </template>
        <div v-else class="h-full flex items-center justify-center">
          <a-empty />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChapter } from '@/pages/common/chapter';
import { ref, computed } from 'vue';
import { SearchOutlined, StarFilled, StarOutlined } from '@ant-design/icons-vue';
import { ContentType } from '@any-reader/rule-utils';
import { useRulesStore } from '@/stores/rules';

const route = useRoute();
const rulesStore = useRulesStore();
const { chaptersRef, showContent, openOriginalVideo, loading, list, description, historys, findHistory, isLastRead, ruleId, isStarred, star } =
  useChapter();

const book = computed(() => ({
  name: String(route.query.name || ''),
  cover: String(route.query.cover || ''),
  author: String(route.query.author || ''),
  description: String(route.query.description || '')
}));
const startChapter = computed(() => {
  const lastReadPath = historys.value[0]?.chapterPath;
  if (lastReadPath) {
    const lastReadChapter = list.value.find((item) => (item.chapterPath || item.url) === lastReadPath);
    if (lastReadChapter) return lastReadChapter;
  }
  return list.value[0];
});
const isMedia = computed(() => {
  const contentType = rulesStore.list.find((rule) => rule.id === ruleId.value)?.contentType;
  return contentType === ContentType.VIDEO || contentType === ContentType.AUDIO;
});
const isVideo = computed(() => rulesStore.list.find((rule) => rule.id === ruleId.value)?.contentType === ContentType.VIDEO);

// 搜索
const searchQuery = ref('');
const filteredList = computed(() => {
  if (!searchQuery.value) return list.value;
  const query = searchQuery.value.toLowerCase();
  return list.value.filter((item) => item.name.toLowerCase().includes(query));
});
</script>
