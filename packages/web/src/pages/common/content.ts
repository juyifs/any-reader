/**
 * 内容阅读相关功能模块
 */
import type { Ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import PQueue from 'p-queue';
import { debounce, kebabCase } from 'lodash-es';
import { ContentType, type ContentResponse } from '@any-reader/rule-utils';
import { getContent } from '@/api';
import { saveChapterHistory } from '@/api/modules/chapter-history';
import { contentDecoder } from '@/api/modules/rule-manager';
import { useChaptersStore } from '@/stores/chapters';
import { useSettingStore, type ReadStyle } from '@/stores/setting';
import { useReadStore } from '@/stores/read';
import { useKeyboardShortcuts } from '@/hooks/useMagicKeys';
import { TTS } from '@/utils/tts';
import { base64 } from '@/api/modules/tts';
import { executeCommand } from '@/api/modules/vsc';
import { IS_BROWSER } from '@/constants';
import { getImageProxyUrl } from '@/utils/imageProxy';
import { filterNovelContent } from '@/utils/contentFilter';
import { getServerChapterCache } from '@/api/modules/chapter-cache';
import { getBrowserChapterCache, getChapterCacheRecordKey, materializeChapterCache, releaseCachedChapterAssets } from '@/utils/chapterCache';

const chapterContentCache = new Map<string, Promise<ContentResponse>>();
const MAX_CACHED_CHAPTERS = 3;

function waitForLayoutFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function getChapterCacheKey(params: Record<string, any>, chapterPath: string) {
  return JSON.stringify([params.ruleId || '', params.filePath || '', chapterPath]);
}

async function fetchChapterContent(params: Record<string, any>, ruleId: string): Promise<ContentResponse> {
  const identity = {
    ruleId,
    url: String(params.filePath || '')
  };
  const chapterPath = String(params.chapterPath || '');

  try {
    const cached = await getBrowserChapterCache(identity, chapterPath);
    if (cached) return materializeChapterCache(cached);
  } catch (error) {
    console.warn('读取浏览器章节缓存失败', error);
  }

  try {
    const cached = await getServerChapterCache({ ...identity, chapterPath });
    if (cached?.code === 0 && cached.data) return materializeChapterCache(cached.data);
  } catch (error) {
    console.warn('读取服务器章节缓存失败，将从书源获取', error);
  }

  const response = await getContent(params);
  if (response?.code !== 0) {
    throw new Error(response?.msg || '获取章节内容失败');
  }

  const chapter = response.data;
  if (!chapter.contentDecoder) return chapter;

  const decodedContent = new Array<string>(chapter.content.length).fill('');
  const tasks = new PQueue({ concurrency: 4 });
  await Promise.all(
    chapter.content.map((item, index) =>
      tasks.add(async () => {
        const result = await contentDecoder({ content: item, ruleId });
        if (result?.code === 0) decodedContent[index] = result.data;
      })
    )
  );

  return {
    ...chapter,
    content: decodedContent,
    contentDecoder: false
  };
}

function cacheChapterContent(key: string, params: Record<string, any>, ruleId: string) {
  const existing = chapterContentCache.get(key);
  if (existing) {
    chapterContentCache.delete(key);
    chapterContentCache.set(key, existing);
    return existing;
  }

  const request = fetchChapterContent(params, ruleId).catch((error) => {
    if (chapterContentCache.get(key) === request) chapterContentCache.delete(key);
    throw error;
  });
  chapterContentCache.set(key, request);
  while (chapterContentCache.size > MAX_CACHED_CHAPTERS) {
    const oldestKey = chapterContentCache.keys().next().value;
    if (oldestKey === undefined) break;
    chapterContentCache.delete(oldestKey);
    try {
      const [ruleId, url, chapterPath] = JSON.parse(oldestKey) as string[];
      releaseCachedChapterAssets(getChapterCacheRecordKey({ ruleId, url }, chapterPath));
    } catch (error) {
      console.warn('释放章节缓存图片资源失败', error);
    }
  }
  return request;
}

/**
 * 保存阅读历史记录的Hook
 */
function useSaveHistory(contentRef: Ref<HTMLElement>, options: Ref<any>) {
  const savePercentage = debounce(
    (params: any) => {
      saveChapterHistory(params);
    },
    400,
    {
      maxWait: 30000
    }
  );

  useEventListener(contentRef, 'scroll', () => {
    const { chapterPath, filePath, ruleId } = options.value;
    const isPaged = contentRef.value.classList.contains('reader-paged-container');
    const scrollableLength = isPaged ? contentRef.value.scrollWidth - contentRef.value.clientWidth : contentRef.value.scrollHeight;
    const currentPosition = isPaged ? contentRef.value.scrollLeft : contentRef.value.scrollTop;
    savePercentage({
      ruleId,
      filePath,
      chapterPath,
      percentage: scrollableLength > 0 ? Math.floor((currentPosition / scrollableLength) * 100000) : 0
    });
  });
}

/**
 * 主题样式设置Hook
 */
export function useTheme(contentRef: Ref<HTMLElement>) {
  const settingStore = useSettingStore();

  watchEffect(
    () => {
      if (!contentRef.value) return;

      const cssVars: (keyof ReadStyle)[] = [
        'textOpacity',
        'sectionSpacing',
        'fontWeight',
        'font',
        'textColor',
        'backgroundColor',
        'fontSize',
        'lineHeight',
        'letterSpacing'
      ];
      for (const vssVar of cssVars) {
        const val = settingStore.data.readStyle[vssVar];
        typeof val !== 'undefined' && contentRef.value.parentElement!.style.setProperty('--' + kebabCase(vssVar), String(val));
      }
    },
    {
      flush: 'post'
    }
  );
}

/**
 * 内容阅读核心Hook
 */
export function useContent(contentRef: Ref<HTMLElement>) {
  const content = ref<string[]>([]);
  const contentType = ref<ContentType | undefined>(ContentType.NOVEL);
  const displayContent = computed(() =>
    contentType.value === ContentType.NOVEL || contentType.value === ContentType.NOVELMORE
      ? filterNovelContent(content.value, settingStore.data.contentFilters)
      : content.value
  );
  const route = useRoute();
  const router = useRouter();
  const chaptersStore = useChaptersStore();
  const settingStore = useSettingStore();
  const readStore = useReadStore();
  const options = computed(() => route.query);
  const loading = ref(false);
  const _onUnmounted: (() => void)[] = [];
  _onUnmounted.push(() => {
    readStore.setPath('');
    readStore.setTitle('');
    readStore.setPreTitle('');
    readStore.setNextTitle('');
  });
  onUnmounted(() => {
    _onUnmounted.forEach((fn) => fn());
  });

  let autoNextScrollTimer: ReturnType<typeof setTimeout> | null = null;
  let autoPrevScrollTimer: ReturnType<typeof setTimeout> | null = null;
  let autoNextLocked = false;
  let autoPrevLocked = false;

  onUnmounted(() => {
    autoNextScrollTimer && clearTimeout(autoNextScrollTimer);
    autoPrevScrollTimer && clearTimeout(autoPrevScrollTimer);
  });

  const isAtScrollStart = () => !contentRef.value || contentRef.value.scrollTop <= 1;
  const isAtScrollEnd = () => {
    if (!contentRef.value) return false;
    return contentRef.value.scrollTop + contentRef.value.clientHeight >= contentRef.value.scrollHeight - 1;
  };

  const triggerPrevChapter = () => {
    if (
      (contentType.value !== ContentType.NOVEL && contentType.value !== ContentType.MANGA) ||
      !lastChapter.value ||
      loading.value ||
      autoPrevLocked ||
      !isAtScrollStart()
    ) {
      return;
    }

    autoPrevLocked = true;
    autoPrevScrollTimer && clearTimeout(autoPrevScrollTimer);
    autoPrevScrollTimer = setTimeout(() => {
      if (isAtScrollStart() && lastChapter.value) {
        onPrevChapterFromStart();
      }
      autoPrevLocked = false;
    }, 250);
  };

  const triggerAutoNextChapter = () => {
    if (
      !settingStore.data.autoNextChapter ||
      (contentType.value !== ContentType.NOVEL && contentType.value !== ContentType.MANGA) ||
      !contentRef.value ||
      !nextChapter.value ||
      loading.value ||
      autoNextLocked ||
      !isAtScrollEnd() ||
      settingStore.data[contentType.value === ContentType.MANGA ? 'mangaPageTurnMode' : 'novelPageTurnMode'] === 'tap'
    ) {
      return;
    }

    autoNextLocked = true;
    autoNextScrollTimer && clearTimeout(autoNextScrollTimer);
    autoNextScrollTimer = setTimeout(() => {
      const isScrollMode = settingStore.data[contentType.value === ContentType.MANGA ? 'mangaPageTurnMode' : 'novelPageTurnMode'] === 'scroll';
      if (settingStore.data.autoNextChapter && isScrollMode && isAtScrollEnd() && nextChapter.value) {
        onNextChapter();
      }

      autoNextLocked = false;
    }, 400);
  };

  useEventListener(contentRef, 'wheel', (event: WheelEvent) => {
    const pageTurnMode = contentType.value === ContentType.MANGA ? settingStore.data.mangaPageTurnMode : settingStore.data.novelPageTurnMode;
    if (pageTurnMode === 'scroll' && event.deltaY < 0 && isAtScrollStart()) {
      triggerPrevChapter();
      return;
    }

    if (event.deltaY > 0 && isAtScrollEnd()) {
      triggerAutoNextChapter();
    }
  });

  let touchStartY = 0;
  let touchStartedAtScrollStart = false;
  let touchStartedAtScrollEnd = false;
  useEventListener(contentRef, 'touchstart', (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY || 0;
    touchStartedAtScrollStart = isAtScrollStart();
    touchStartedAtScrollEnd = isAtScrollEnd();
  });
  useEventListener(contentRef, 'touchmove', (event: TouchEvent) => {
    const currentY = event.touches[0]?.clientY || touchStartY;
    const pageTurnMode = contentType.value === ContentType.MANGA ? settingStore.data.mangaPageTurnMode : settingStore.data.novelPageTurnMode;
    if (pageTurnMode === 'scroll' && touchStartedAtScrollStart && currentY - touchStartY > 10) {
      triggerPrevChapter();
      touchStartedAtScrollStart = false;
      return;
    }

    if (touchStartedAtScrollEnd && touchStartY - currentY > 10) {
      triggerAutoNextChapter();
      touchStartedAtScrollEnd = false;
    }
  });

  useSaveHistory(contentRef, options);
  const tts = useTTS(contentRef, onNextChapter);
  const ttsStatus = ref(false);

  function toggleTTS() {
    ttsStatus.value = tts.startOrStop();
  }

  function stopTTS() {
    tts.destroy();
    ttsStatus.value = false;
  }

  const chapterPath = ref<string>('');

  /**
   * 获取上一章节路径
   */
  const lastChapter = computed<string>(() => {
    if (!chapterPath.value) return '';
    const idx = chaptersStore.chapters.findIndex((e: any) => e.chapterPath === chapterPath.value);
    const item: any = idx === 0 ? null : chaptersStore.chapters[idx - 1];
    readStore.setPreTitle(item?.name || '');
    return item?.chapterPath || '';
  });

  /**
   * 获取下一章节路径
   */
  const nextChapter = computed<string>(() => {
    if (!chapterPath.value) return '';
    const idx = chaptersStore.chapters.findIndex((e: any) => e.chapterPath === chapterPath.value) + 1;
    if (idx === 0) return '';
    const item: any = chaptersStore.chapters.length - 1 < idx ? null : chaptersStore.chapters[idx];
    readStore.setNextTitle(item?.name || '');
    return item?.chapterPath || '';
  });

  /**
   * 预加载章节内容
   */
  function preload(chapterPath: string) {
    const params = { ...route.query, chapterPath };
    const key = getChapterCacheKey(params, chapterPath);
    cacheChapterContent(key, params, String(route.query.ruleId || '')).catch((error) => {
      console.error('章节预加载失败', error);
    });
  }

  /**
   * 初始化
   * @param noCache 是否不使用缓存
   */
  async function init(noCache = false) {
    autoNextLocked = false;
    autoNextScrollTimer && clearTimeout(autoNextScrollTimer);
    autoNextScrollTimer = null;
    autoPrevLocked = false;
    autoPrevScrollTimer && clearTimeout(autoPrevScrollTimer);
    autoPrevScrollTimer = null;

    const { chapterPath: _chapterPath, filePath, ruleId, percentage } = route.query as Record<string, string>;
    content.value = [];
    if (contentRef.value) {
      contentRef.value.scrollTop = 0;
      contentRef.value.scrollLeft = 0;
    }
    loading.value = true;
    const params = { ...route.query, chapterPath: _chapterPath };
    const cacheKey = getChapterCacheKey(params, String(_chapterPath || ''));
    let chapter: ContentResponse | undefined;
    try {
      if (noCache) {
        chapterContentCache.delete(cacheKey);
        chapter = await cacheChapterContent(cacheKey, { ...params, noCache: true }, String(ruleId || ''));
      } else {
        chapter = await cacheChapterContent(cacheKey, params, String(ruleId || ''));
      }
    } catch {
      chapter = undefined;
    }
    loading.value = false;
    chapterPath.value = _chapterPath as string;
    await chaptersStore.getChapters(filePath as string, ruleId as string);
    const chapterInfo = chaptersStore.chapters.find((e) => e.chapterPath === route.query.chapterPath);
    readStore.setPath(chapterInfo?.chapterPath || '');
    readStore.setTitle(chapterInfo?.name || '');
    // 设置标题
    executeCommand({ command: 'any-reader.setTitle', data: [readStore.title] });

    if (lastChapter.value) {
      preload(lastChapter.value);
    }
    if (nextChapter.value) {
      preload(nextChapter.value);
    }
    if (chapter) {
      const { contentType: _contentType, content: _content } = chapter;
      contentType.value = _contentType;
      content.value = (IS_BROWSER && _contentType === ContentType.MANGA ? (_content || []).map(getImageProxyUrl) : _content) || [];
    }

    // 确保内容已经渲染完成后再设置滚动位置
    await nextTick();
    if (contentRef.value?.classList.contains('reader-paged-container')) {
      await waitForLayoutFrame();
      await waitForLayoutFrame();
    }

    if (percentage && contentRef.value) {
      if (contentRef.value.classList.contains('reader-paged-container')) {
        const maxScrollLeft = contentRef.value.scrollWidth - contentRef.value.clientWidth;
        const pageWidth = contentRef.value.clientWidth;
        const targetScrollLeft = maxScrollLeft * (+percentage / 100000);
        const pageIndex = Math.round(targetScrollLeft / pageWidth);
        contentRef.value.scrollLeft = Math.min(maxScrollLeft, pageIndex * pageWidth);
      } else {
        const scrollTop = contentRef.value.scrollHeight * (+percentage / 100000);
        contentRef.value.scrollTop = scrollTop;
      }
    }

    if (ttsStatus.value) {
      tts.start();
    }
  }

  // 路由被改变
  watch(
    () => route.query,
    () => init(),
    {
      immediate: true,
      deep: true
    }
  );

  /**
   * 跳转到指定章节
   */
  function toChapter(chapterPath: string, percentage = 0) {
    if (!chapterPath) return;
    router.replace({
      name: route.name as string,
      query: {
        ...route.query,
        percentage,
        chapterPath
      }
    });
  }

  /**
   * 跳转到上一章
   */
  function onPrevChapter() {
    toChapter(lastChapter.value);
  }

  function onPrevChapterFromStart() {
    toChapter(lastChapter.value, 100000);
  }

  /**
   * 跳转到下一章
   */
  function onNextChapter() {
    toChapter(nextChapter.value);
  }

  /**
   * 向上翻页
   */
  function onPageUp() {
    if (contentRef.value.classList.contains('reader-paged-container')) {
      if (contentRef.value.scrollLeft <= 1 && lastChapter.value) {
        onPrevChapterFromStart();
        return;
      }
      contentRef.value.scrollLeft = Math.max(0, contentRef.value.scrollLeft - contentRef.value.clientWidth);
      return;
    }

    if (contentRef.value.scrollTop <= 1 && lastChapter.value) {
      onPrevChapterFromStart();
      return;
    }

    contentRef.value.scrollTo({
      top: contentRef.value.scrollTop - contentRef.value.offsetHeight + 15,
      behavior: 'smooth'
    });
  }

  /**
   * 向下翻页
   */
  function onPageDown() {
    if (contentRef.value.classList.contains('reader-paged-container')) {
      const maxScrollLeft = contentRef.value.scrollWidth - contentRef.value.clientWidth;
      if (contentRef.value.scrollLeft >= maxScrollLeft - 1 && settingStore.data.autoNextChapter && nextChapter.value) {
        onNextChapter();
        return;
      }
      contentRef.value.scrollLeft = Math.min(maxScrollLeft, contentRef.value.scrollLeft + contentRef.value.clientWidth);
      return;
    }

    contentRef.value.scrollTo({
      top: contentRef.value.scrollTop + contentRef.value.offsetHeight - 15,
      behavior: 'smooth'
    });
  }

  // 监听热键
  useKeyboardShortcuts(
    {
      passive: false,
      target: contentRef,
      onEventFired: (e) => {
        e.preventDefault();
      }
    },
    (cmd: string) => {
      const cmdMap: any = {
        prevChapter: onPrevChapter,
        nextChapter: onNextChapter,
        pageUp: onPageUp,
        pageDown: onPageDown,
        tts: toggleTTS
      };
      cmdMap[cmd] && cmdMap[cmd]();
    }
  );

  return {
    init,
    settingStore,
    content,
    displayContent,
    contentType,
    toChapter,
    lastChapter,
    nextChapter,
    onPageUp,
    onPageDown,
    onPrevChapter,
    onNextChapter,
    ttsStatus,
    toggleTTS,
    stopTTS,
    loading
  };
}

/**
 * 文本转语音Hook
 */
export function useTTS(contentRef: Ref<HTMLElement>, ended: () => void) {
  let tts: TTS | null;

  const route = useRoute();
  const settingStore = useSettingStore();

  /**
   * 销毁TTS实例
   */
  function destroy() {
    if (tts) {
      tts.destroy();
      tts = null;
    }
  }

  watch(
    () => route.fullPath,
    () => {
      destroy();
    }
  );

  onDeactivated(destroy);
  onUnmounted(destroy);

  /**
   * 开始TTS
   */
  function start() {
    tts = new TTS(
      contentRef.value,
      (text: string) => {
        return base64({ text, settings: { ...settingStore.data.tts } }).then((e) => e.data);
      },
      ended
    );
  }

  return {
    start,
    destroy,
    startOrStop() {
      if (!tts) {
        start();
        return true;
      } else {
        return tts.startOrStop();
      }
    }
  };
}
