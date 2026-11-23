<template>
  <div class="h-full overflow-auto">
    <SettingRow title="开源阅读朗读网址">
      <a-input v-model:value="settingStore.data.tts.url" class="!w-260px" placeholder="粘贴 ms-ra-forwarder 导入网址" />
    </SettingRow>
    <SettingRow title="音量（-100 至 100）">
      <a-input-number v-model:value="settingStore.data.tts.volume" class="!w-180px" :min="-100" :max="100" placeholder="默认 100" />
    </SettingRow>
    <SettingRow title="语速（-100 至 100）">
      <a-input-number v-model:value="settingStore.data.tts.rate" class="!w-180px" :min="-100" :max="100" placeholder="默认 0" />
    </SettingRow>
    <SettingRow title="音调（-100 至 100）">
      <a-input-number v-model:value="settingStore.data.tts.pitch" class="!w-180px" :min="-100" :max="100" placeholder="默认 0" />
    </SettingRow>
  </div>
</template>

<script setup>
import { useSettingStore } from '@/stores/setting';
import SettingRow from '../SettingRow/index.vue';

const settingStore = useSettingStore();
</script>
