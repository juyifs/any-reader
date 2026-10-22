<template>
  <div class="setting-row flex items-center gap-5 b-b b-b-1 b-b-[--ar-color-border] b-b-solid px-10">
    <div class="setting-row__title">{{ props.title }}</div>
    <div class="setting-row__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
}>();
</script>

<style scoped>
.setting-row {
  min-height: 44px;
  padding-top: 5px;
  padding-bottom: 5px;
  line-height: 1.4;
}

.setting-row__title {
  min-width: 0;
  flex: 1 1 140px;
  overflow-wrap: anywhere;
}

.setting-row__control {
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
  margin-left: auto;
}
</style>
