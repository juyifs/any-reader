<template>
  <div class="h-full w-full flex flex-col">
    <vscode-panels>
      <vscode-panel-tab v-for="(nav, idx) in navs" :id="nav.title" :key="nav.title" @click="activeNavIdx = idx">{{ nav.title }}</vscode-panel-tab>
      <vscode-panel-view v-for="nav in navs" :id="nav.title" :key="nav.title" class="hidden"></vscode-panel-view>
    </vscode-panels>
    <div class="flex-1 overflow-auto">
      <component :is="navs[activeNavIdx].component" />
    </div>
  </div>
</template>

<script setup>
import History from './History.vue';
import Shelf from './Shelf.vue';

const navs = [
  { title: '书架', component: Shelf },
  { title: '历史', component: History }
];

const activeNavIdx = ref(0);
</script>

<style></style>
