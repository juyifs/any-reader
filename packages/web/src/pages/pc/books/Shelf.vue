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
      <div
        v-if="item.type === 'favorite'"
        class="star invisible absolute right-5 top-5 flex items-center justify-center rounded-10 px-2 py-2 text-[--ar-color-text]"
        @click.stop="favoritesStore.unstar({ url: item.url, ruleId: item.ruleId })"
      >
        <StarFilled :size="14" />
      </div>
    </Book>
  </template>
</template>

<script setup>
import { getLocalBooks } from '@/api';
import { useFavoritesStore } from '@/stores/favorites';
import Book from './Book.vue';

const favoritesStore = useFavoritesStore();
const localList = ref([]);
const list = computed(() => [
  ...localList.value.map((item) => ({ ...item, url: item.path, type: 'local' })),
  ...favoritesStore.list.map((item) => ({ ...item, type: 'favorite' }))
]);

onMounted(async () => {
  const res = await getLocalBooks();
  if (res?.code === 0) localList.value = res.data || [];
  await favoritesStore.sync();
});
</script>

<style lang="scss">
.star {
  visibility: visible;
}

@media (hover: hover) and (pointer: fine) {
  .star {
    visibility: hidden;
  }

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
}
</style>
