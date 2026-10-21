<template>
  <ARRuleEmpty v-if="!rulesStore.list.length" />
  <div v-else class="h-full flex flex-col bg-[--ar-main-background] px-10 py-10 text-[--ar-color-text]">
    <div class="mb-10 flex gap-10">
      <div class="flex flex-1 items-center gap-10">
        <a-input-group compact class="!flex">
          <a-select v-model:value="contentType">
            <a-select-option v-for="item in CONTENT_TYPES" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="selectedRuleId" class="min-w-140" :disabled="loading">
            <a-select-option value="">全部站点</a-select-option>
            <a-select-option v-for="rule in availableRules" :key="rule.id" :value="rule.id">{{ rule.name }}</a-select-option>
          </a-select>
          <a-input v-model:value="searchText" placeholder="输入关键词，回车键搜索" :disabled="loading" allow-clear @keyup.enter="onSearch()" />
        </a-input-group>
      </div>
    </div>
    <!-- 搜索进度 -->
    <div v-if="loading" class="flex items-center text-[--ar-color-text]">
      <a-button class="mr-5" @click="cancelSearch">取消</a-button>
      <ASpin />
      <div v-if="runCount > 0" class="ml-2">搜索进度: {{ runCount }}/{{ total }} {{ ((runCount / total) * 100).toFixed(0) }}%</div>
    </div>
    <div class="flex-1 overflow-auto text-[--ar-color-text]">
      <!-- 规则列表 -->
      <template v-for="item in list" :key="item.rule.id">
        <div v-if="item.list.length" class="pt-20">
          <div class="mb-6">{{ item.rule.name }}</div>
          <BookResultRow
            v-for="(row, idx) in item.list"
            :key="idx"
            :row="row"
            :is-starred="favoritesStore.starred({ ...row, ruleId: item.rule.id })"
            @select="getChapter(row, item.rule)"
            @favorite="favoritesStore.star({ ...row, ruleId: item.rule.id })"
          />
        </div>
      </template>
      <div v-if="list.some((item) => item.hasMore)" class="py-10 text-center">
        <a-button :loading="loading" :disabled="loading" @click="loadMore">加载更多</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import { CONTENT_TYPES } from '@/constants';
import { useRulesStore } from '@/stores/rules';
import { useFavoritesStore } from '@/stores/favorites';
import { useSearch } from '@/pages/common/search';

const favoritesStore = useFavoritesStore();
const rulesStore = useRulesStore();

const { contentType, selectedRuleId, availableRules, searchText, onSearch, loadMore, cancelSearch, loading, runCount, total, list, getChapter } =
  useSearch();
</script>
