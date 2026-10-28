import { merge } from 'lodash-es';
import { readConfig, updateConfig } from '@/api';
import type { ThemeToken } from '@/constants/theme';
import type { FontData } from '@/utils/font';

export type ReadStyle = {
  // 字体
  font: FontData;
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
  textOpacity: number;
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
  volume: number | null;
  rate: number | null;
  pitch: number | null;
};

// 侧边栏
export type Sidebar = 'left' | 'right' | 'hidden' | '';
export type PageTurnMode = 'scroll' | 'tap';

export type Setting = {
  readStyle: ReadStyle;
  keyboardShortcuts: KeyboardShortcuts;
  autoNextChapter: boolean;
  novelPageTurnMode: PageTurnMode;
  mangaPageTurnMode: PageTurnMode;
  contentFilters: string[];
  tts: TTSSettings;
  sidebar: Sidebar;
  bookDir: string;
  theme: ThemeToken | null;
};

export const useSettingStore = defineStore('setting', () => {
  const data = reactive<Setting>({
    readStyle: {
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 1,
      textColor: '#ffffffb3',
      backgroundColor: '#1f1f1f',
      fontWeight: 400,
      sectionSpacing: 12,
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
      voice: 'zh-CN-XiaoxiaoNeural',
      volume: null,
      rate: null,
      pitch: null
    },
    sidebar: 'left',
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
        delete (data as Setting & { pageTurnMode?: PageTurnMode }).pageTurnMode;
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
