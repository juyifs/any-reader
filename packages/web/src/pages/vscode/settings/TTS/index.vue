<template>
  <div>
    <SettingRow title="开源阅读朗读网址">
      <vscode-text-field
        :value="settingStore.data.tts.url"
        class="w-full"
        placeholder="粘贴 ms-ra-forwarder 导入网址"
        @input="(event) => (settingStore.data.tts.url = event.target.value)"
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
