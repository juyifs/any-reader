<template>
  <div class="h-full overflow-auto">
    <SettingRow title="字体">
      <a-select
        v-model:value="settingStore.data.readStyle.font"
        :options="fontList"
        show-search
        allow-clear
        :filter-option="true"
        class="!w-180px"
        option-filter-prop="fullName"
        :field-names="{
          label: 'fullName',
          value: 'family'
        }"
      >
      </a-select>
    </SettingRow>
    <SettingRow title="字体大小">
      <a-input-number v-model:value="settingStore.data.readStyle.fontSize" class="!w-120px" mode="button" />
    </SettingRow>
    <SettingRow title="字体粗细">
      <a-input-number v-model:value="settingStore.data.readStyle.fontWeight" :step="100" class="!w-120px" mode="button" />
    </SettingRow>
    <SettingRow title="行高">
      <a-input-number v-model:value="settingStore.data.readStyle.lineHeight" class="!w-120px" mode="button" />
    </SettingRow>
    <SettingRow title="文字间距">
      <a-input-number v-model:value="settingStore.data.readStyle.letterSpacing" class="!w-120px" mode="button" />
    </SettingRow>
    <SettingRow title="段落间距">
      <a-input-number v-model:value="settingStore.data.readStyle.sectionSpacing" class="!w-120px" mode="button" />
    </SettingRow>
    <SettingRow title="小说翻页方式">
      <a-select v-model:value="settingStore.data.novelPageTurnMode" class="!w-180px">
        <a-select-option value="scroll">滚动</a-select-option>
        <a-select-option value="tap">左右翻页</a-select-option>
      </a-select>
    </SettingRow>
    <SettingRow title="漫画翻页方式">
      <a-select v-model:value="settingStore.data.mangaPageTurnMode" class="!w-180px">
        <a-select-option value="scroll">滚动</a-select-option>
        <a-select-option value="tap">左右翻页</a-select-option>
      </a-select>
    </SettingRow>
    <SettingRow title="滚动到底部自动下一章">
      <a-switch v-model:checked="settingStore.data.autoNextChapter" />
    </SettingRow>
    <SettingRow title="TTS 接口地址">
      <a-input v-model:value="settingStore.data.tts.endpoint" class="!w-260px" placeholder="留空使用内置 Edge TTS" />
    </SettingRow>
    <SettingRow title="TTS Token">
      <a-input-password v-model:value="settingStore.data.tts.token" class="!w-260px" placeholder="可选" />
    </SettingRow>
    <SettingRow title="TTS 声音 ID">
      <a-input v-model:value="settingStore.data.tts.voice" class="!w-260px" placeholder="zh-CN-XiaoxiaoNeural" />
    </SettingRow>
    <SettingRow title="文字颜色">
      <input v-model="settingStore.data.readStyle.textColor" type="color" style="border: solid 1px rgba(0, 0, 0, 0.1)" />
    </SettingRow>
    <SettingRow title="背景颜色">
      <input v-model="settingStore.data.readStyle.backgroundColor" type="color" style="border: solid 1px rgba(0, 0, 0, 0.1)" />
    </SettingRow>
    <SettingRow title="推荐背景色">
      <div class="max-w-full flex flex-wrap justify-end gap-4">
        <div
          v-for="color in THEME"
          :key="color.label"
          :style="{
            background: color.color
          }"
          :title="color.label"
          class="h-30 w-30 cursor-pointer b-0 rounded-4 hover:b-2"
          @click="changeTheme(color)"
        />
      </div>
    </SettingRow>
  </div>
</template>

<script setup>
import { THEME } from '@/constants/theme';
import { useSettingStore } from '@/stores/setting';
import SettingRow from '../SettingRow/index.vue';
import { getFontList } from '@/utils/font';

const setTheme = inject('setTheme');
const settingStore = useSettingStore();
const fontList = ref([]);

// 设置颜色
function changeTheme(color) {
  settingStore.data.readStyle.backgroundColor = color.color;
  settingStore.data.readStyle.textColor = color.textColor;
  setTheme(color.theme);
}

onMounted(() => {
  getFontList().then((e) => {
    fontList.value = e;
  });
});
</script>
