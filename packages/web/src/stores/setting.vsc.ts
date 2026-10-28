import { merge } from 'lodash-es';
import { readConfig, updateConfig } from '@/api';
import type { ThemeToken } from '@/constants/theme';

export type ReadStyle = {
  // 字体大小
  fontSize: number;
  // 字体粗细
  fontWeight: number;
  // 行高
  lineHeight: number;
  // 文字间距
  letterSpacing: number;
  // 段落间距
  sectionSpacing: number;
  // 文字颜色
  textColor: string;
  // 背景颜色
  backgroundColor: string;
  // 文字透明度
  textOpacity: 1;
};

// 快捷键
export type KeyboardShortcuts = {
  prevChapter: string;
  nextChapter: string;
  pageUp: string;
  pageDown: string;
  tts: string;
};

export type TTSSettings = {
  endpoint: string;
  token: string;
  voice: string;
};

export type Setting = {
  readStyle: ReadStyle;
  keyboardShortcuts: KeyboardShortcuts;
  autoNextChapter: boolean;
  novelPageTurnMode: 'scroll' | 'tap';
  mangaPageTurnMode: 'scroll' | 'tap';
  contentFilters: string[];
  tts: TTSSettings;
  bookDir: string;
  theme: ThemeToken | null;
};

export const useSettingStore = defineStore('setting', () => {
  const data = reactive<Setting>({
    readStyle: {
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 1,
      fontWeight: 400,
      sectionSpacing: 12,
      textColor: '',
      backgroundColor: '',
      textOpacity: 1
    },
    keyboardShortcuts: {
      prevChapter: '←',
      nextChapter: '→',
      pageUp: '↑',
      pageDown: '↓',
      tts: ''
    },
    autoNextChapter: true,
    novelPageTurnMode: 'scroll',
    mangaPageTurnMode: 'scroll',
    contentFilters: [],
    tts: {
      endpoint: '',
      token: '',
      voice: 'zh-CN-XiaoxiaoNeural'
    },
    bookDir: '',
    theme: null
  });

  // 同步
  async function sync() {
    const res = await readConfig().catch(() => {});
    if (res?.code === 0) {
      const config = res.data || {};
      const legacyPageTurnMode = config.pageTurnMode;
      merge(data, config);
      if (legacyPageTurnMode === 'scroll' || legacyPageTurnMode === 'tap') {
        if (!Object.hasOwn(config, 'novelPageTurnMode')) data.novelPageTurnMode = legacyPageTurnMode;
        if (!Object.hasOwn(config, 'mangaPageTurnMode')) data.mangaPageTurnMode = legacyPageTurnMode;
        delete (data as Setting & { pageTurnMode?: 'scroll' | 'tap' }).pageTurnMode;
      }
    }
  }

  watch(data, (v) => {
    updateConfig(toRaw(v));
  });

  sync();

  return {
    data,
    sync
  };
});
