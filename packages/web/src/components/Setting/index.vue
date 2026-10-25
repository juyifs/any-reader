<template>
  <div class="h-300 max-h-[70vh] w-full flex flex-col overflow-hidden bg-[--activityBar-background] text-[--ar-color-text-secondary] sm:flex-row">
    <div
      class="flex shrink-0 gap-4 overflow-x-auto rounded-8 bg-[--ar-chapter-bg] p-5 text-[--ar-color-text] sm:h-full sm:w-120 sm:flex-col sm:gap-0 sm:overflow-x-hidden sm:overflow-y-auto sm:p-10"
    >
      <div v-for="(nav, idx) in navs" :key="nav.title" class="shrink-0" @click="activeNavIdx = idx">
        <div
          :class="[
            'h-32 whitespace-nowrap rounded-10 px-10 lh-32 mb-5 cursor-pointer hover:text-[--ar-color-primary-text]',
            activeNavIdx === idx ? 'bg-[--ar-color-primary-bg] text-[--ar-color-primary-text]' : ''
          ]"
        >
          {{ nav.title }}
        </div>
      </div>
    </div>
    <div class="mt-5 min-h-0 min-w-0 flex-1 overflow-auto rounded-8 bg-[--ar-chapter-bg] sm:ml-10 sm:mt-0">
      <component :is="navs[activeNavIdx].component" />
    </div>
  </div>
</template>

<script setup>
import ReadPage from './components/ReadPage/index.vue';
import KeyboardShortcuts from './components/KeyboardShortcuts/index.vue';
import ContentFilters from './components/ContentFilters/index.vue';
import App from './components/App/index.vue';
import About from './components/About/index.vue';

const navs = [
  { title: '阅读页', component: ReadPage },
  { title: '过滤标签', component: ContentFilters },
  { title: '热键', component: KeyboardShortcuts },
  { title: '应用', component: App },
  { title: '关于', component: About }
];

const activeNavIdx = ref(0);
</script>
