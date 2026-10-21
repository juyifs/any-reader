<template>
  <div class="flex gap-12 border-b border-[--ar-color-border] border-solid py-10">
    <div class="h-120 w-90 shrink-0 cursor-pointer overflow-hidden rounded-5" @click="emit('select')">
      <ARCover :src="row.cover" :preview="false" alt="" srcset="" class="h-full w-full object-cover" width="100%" height="100%" fit="cover" />
    </div>
    <div class="min-w-0 flex flex-1 flex-col justify-center gap-5">
      <div class="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-16 font-bold" :title="row.name" @click="emit('select')">
        {{ row.name }}
      </div>
      <div v-if="row.author" class="overflow-hidden text-ellipsis whitespace-nowrap text-13 op-70" :title="row.author">作者：{{ row.author }}</div>
      <div v-if="row.chapter" class="overflow-hidden text-ellipsis whitespace-nowrap text-13 op-70" :title="row.chapter">
        最新章节：{{ row.chapter }}
      </div>
      <div v-if="row.description" class="max-h-40 overflow-hidden text-ellipsis text-13 op-70" :title="row.description">
        {{ row.description }}
      </div>
    </div>
    <a-button type="text" class="h-32 w-32 shrink-0 self-start" :title="isStarred ? '取消收藏' : '收藏'" @click.stop="emit('favorite')">
      <StarFilled v-if="isStarred" />
      <StarOutlined v-else />
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { StarFilled, StarOutlined } from '@ant-design/icons-vue';

defineProps<{
  row: {
    name: string;
    cover?: string;
    author?: string;
    chapter?: string;
    description?: string;
  };
  isStarred: boolean;
}>();

const emit = defineEmits<{
  select: [];
  favorite: [];
}>();
</script>
