<template>
  <div>
    <SettingRow title="TTS 接口地址">
      <vscode-text-field
        :value="settingStore.data.tts.endpoint"
        class="w-full"
        placeholder="留空使用内置 Edge TTS"
        @input="(event) => (settingStore.data.tts.endpoint = event.target.value)"
      />
    </SettingRow>
    <SettingRow title="TTS Token">
      <vscode-text-field
        :value="settingStore.data.tts.token"
        class="w-full"
        type="password"
        placeholder="可选"
        @input="(event) => (settingStore.data.tts.token = event.target.value)"
      />
    </SettingRow>
    <SettingRow title="TTS 声音 ID">
      <vscode-text-field
        :value="settingStore.data.tts.voice"
        class="w-full"
        placeholder="zh-CN-XiaoxiaoNeural"
        @input="(event) => (settingStore.data.tts.voice = event.target.value)"
      />
    </SettingRow>
    <SettingRow title="音量（-100 至 100）">
      <vscode-text-field
        :value="settingStore.data.tts.volume ?? ''"
        class="w-full"
        type="number"
        min="-100"
        max="100"
        placeholder="留空使用默认值 100"
        @input="(event) => (settingStore.data.tts.volume = event.target.value === '' ? null : Number(event.target.value))"
      />
    </SettingRow>
    <SettingRow title="语速（-100 至 100）">
      <vscode-text-field
        :value="settingStore.data.tts.rate ?? ''"
        class="w-full"
        type="number"
        min="-100"
        max="100"
        placeholder="留空使用默认值 0"
        @input="(event) => (settingStore.data.tts.rate = event.target.value === '' ? null : Number(event.target.value))"
      />
    </SettingRow>
    <SettingRow title="音调（-100 至 100）">
      <vscode-text-field
        :value="settingStore.data.tts.pitch ?? ''"
        class="w-full"
        type="number"
        min="-100"
        max="100"
        placeholder="留空使用默认值 0"
        @input="(event) => (settingStore.data.tts.pitch = event.target.value === '' ? null : Number(event.target.value))"
      />
    </SettingRow>
  </div>
</template>

<script setup>
import { useSettingStore } from '@/stores/setting';
import SettingRow from '../SettingRow/index.vue';

const settingStore = useSettingStore();
</script>
