<template>
  <div class="h-full overflow-auto">
    <SettingRow title="TTS 接口地址">
      <a-input v-model:value="settingStore.data.tts.endpoint" class="!w-260px" placeholder="留空使用内置 Edge TTS" />
    </SettingRow>
    <SettingRow title="TTS Token">
      <a-input-password v-model:value="settingStore.data.tts.token" class="!w-260px" placeholder="可选" />
    </SettingRow>
    <SettingRow title="TTS 声音 ID">
      <a-input v-model:value="settingStore.data.tts.voice" class="!w-260px" placeholder="zh-CN-XiaoxiaoNeural" />
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
