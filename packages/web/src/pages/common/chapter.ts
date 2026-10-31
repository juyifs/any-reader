/**
 * 章节相关功能模块
 */
import { stringify } from 'qs';
import { App } from 'ant-design-vue';
import { ContentType } from '@any-reader/rule-utils';
import { getChapter, getContent } from '@/api';
import { getChapterHistorys } from '@/api/modules/chapter-history';
import { listServerChapterCache } from '@/api/modules/chapter-cache';
import { openWindow } from '@/api/modules/electron';
import { useRulesStore } from '@/stores/rules';
import { useFavoritesStore } from '@/stores/favorites';
import { listBrowserChapterCache } from '@/utils/chapterCache';

function getFirstContentValue(content: unknown) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && typeof content[0] === 'string') return content[0];
  return '';
}

/**
 * 收藏相关功能Hook
 * @param params - 路由参数
 * @returns 收藏相关的状态和方法
 */
function useFavorites(getParams: () => Record<string, string>) {
  const favoritesStore = useFavoritesStore();

  /**
   * 判断当前内容是否已收藏
   */
  const isStarred = computed<boolean>(() => {
    const params = getParams();
    const { filePath, ruleId } = params;
    if (!ruleId) return false;
    return favoritesStore.starred({ url: filePath, ruleId });
  });

  /**
   * 收藏当前内容
   */
  function star() {
    const params = getParams();
    const { ruleId } = params;
    if (!ruleId) return false;
    favoritesStore.star({ ...params, url: params.filePath, ruleId });
  }

  return {
    favoritesStore,
    isStarred,
    star
  };
}

/**
 * 章节列表相关功能Hook
 * @returns 章节列表相关的状态和方法
 */
export function useChapter() {
  const { message } = App.useApp();

  const chaptersRef = ref();
  const route = useRoute();
  const router = useRouter();
  const rulesStore = useRulesStore();

  /** 当前规则ID */
  const ruleId = computed(() => route.query.ruleId);

  const loading = ref(false);
  const resolvingVideoPaths = ref<string[]>([]);
  const originalVideoUrls = ref<Record<string, string>>({});
  let videoRequestGeneration = 0;
  /** 章节列表数据 */
  const list = ref<any[]>([]);
  /** 已缓存章节路径 */
  const cachedChapterPaths = ref(new Set<string>());
  /** 从章节页提取的简介 */
  const description = ref('');
  /** 阅读历史数据 */
  const historys = ref<any[]>([]);

  /**
   * 获取章节阅读历史
   */
  async function chapterHistory() {
    const { filePath, ruleId } = route.query;
    const res = await getChapterHistorys({
      ruleId,
      filePath
    });
    const rows = res?.data || [];
    historys.value = rows;
    if (rows.length && rows[0].chapterPath) {
      chaptersRef.value?.querySelector(`[data-url="${rows[0].chapterPath}"]`)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function refreshChapterCacheStatus() {
    const { filePath, ruleId } = route.query as Record<string, string>;
    if (!filePath || !ruleId) {
      cachedChapterPaths.value = new Set();
      return;
    }

    const identity = { ruleId, url: filePath };
    const cachedPaths = new Set<string>();
    const [browserResult, serverResult] = await Promise.allSettled([listBrowserChapterCache(identity), listServerChapterCache(identity)]);

    if (browserResult.status === 'fulfilled') {
      browserResult.value.forEach(({ chapterPath }) => cachedPaths.add(chapterPath));
    } else {
      console.warn('读取浏览器章节缓存状态失败', browserResult.reason);
    }

    if (serverResult.status === 'fulfilled' && serverResult.value?.code === 0) {
      serverResult.value.data.forEach(({ chapterPath }) => cachedPaths.add(chapterPath));
    } else {
      console.warn('读取服务器章节缓存状态失败', serverResult.status === 'rejected' ? serverResult.reason : serverResult.value?.msg);
    }
    cachedChapterPaths.value = cachedPaths;
  }

  /**
   * 初始化章节列表数据
   */
  async function init() {
    videoRequestGeneration++;
    resolvingVideoPaths.value = [];
    originalVideoUrls.value = {};
    list.value = [];
    description.value = '';
    const { filePath, ruleId } = route.query as Record<string, string>;
    if (!filePath && !ruleId) return;
    loading.value = true;
    const res = await getChapter(filePath, ruleId).catch(() => {});
    if (res?.code === 0) {
      list.value = res?.data || [];
      description.value = list.value.find((item) => item.description)?.description || '';
    }
    if (!list.value.length && ruleId) {
      const identity = { ruleId, url: filePath };
      const cachedChapters = new Map<string, { chapterPath: string; chapterIndex: number; chapterName: string }>();
      try {
        for (const chapter of await listBrowserChapterCache(identity)) {
          cachedChapters.set(chapter.chapterPath, {
            chapterPath: chapter.chapterPath,
            chapterIndex: chapter.chapterIndex,
            chapterName: chapter.chapterName
          });
        }
      } catch {
        // IndexedDB may be unavailable in some embedded browsers; the server cache can still be used.
      }
      try {
        const cached = await listServerChapterCache(identity);
        if (cached?.code === 0) {
          for (const chapter of cached.data) {
            if (!cachedChapters.has(chapter.chapterPath)) {
              cachedChapters.set(chapter.chapterPath, {
                chapterPath: chapter.chapterPath,
                chapterIndex: chapter.chapterIndex,
                chapterName: chapter.chapterName
              });
            }
          }
        }
      } catch {
        // Keep any browser-cached chapters when the server is unavailable.
      }
      list.value = [...cachedChapters.values()]
        .sort((a, b) => a.chapterIndex - b.chapterIndex || a.chapterPath.localeCompare(b.chapterPath))
        .map(({ chapterPath, chapterName }) => ({ chapterPath, url: chapterPath, name: chapterName }));
    }
    await refreshChapterCacheStatus();
    loading.value = false;
    await chapterHistory();
  }

  onActivated(() => {
    init();
  });

  /**
   * 查找章节的阅读历史记录
   * @param item - 章节项
   * @returns 历史记录项
   */
  function findHistory(item: any) {
    return historys.value.find((history) => history.chapterPath === item.chapterPath);
  }

  function isChapterCached(item: any) {
    return cachedChapterPaths.value.has(String(item.chapterPath || item.url || ''));
  }

  /**
   * 判断是否为最后阅读的章节
   * @param item - 章节项
   * @returns 是否为最后阅读
   */
  function isLastRead(item: any) {
    if (!historys.value.length) return false;
    return historys.value[0].chapterPath === item.chapterPath;
  }

  /**
   * 显示章节内容
   * @param item - 章节项
   */
  async function showContent(item: any) {
    const { filePath, ruleId, name } = route.query;
    const history = findHistory(item);
    const rule = rulesStore.list.find((e) => e.id === ruleId);
    const params = {
      percentage: history?.percentage ?? 0
    };

    // 处理视频类型内容
    if (rule?.contentType === ContentType.VIDEO) {
      loading.value = true;
      const res = await getContent({
        filePath,
        ruleId,
        chapterPath: item.url || item.chapterPath
      }).catch(() => {});
      loading.value = false;
      const url = getFirstContentValue(res?.data?.content);
      if (res?.code === 0 && url) {
        openWindow({
          url:
            '/player?' +
            stringify({
              url,
              name,
              chapterName: item.name
            })
        });
      } else {
        message.warning('获取地址失败！');
      }
      return;
    }
    // 处理音频类型内容
    // TODO: 音频规则, 待优化
    else if (rule?.contentType === ContentType.AUDIO) {
      const res = await getContent({
        filePath,
        ruleId,
        chapterPath: item.url || item.chapterPath
      }).catch(() => {});
      const url = getFirstContentValue(res?.data?.content);
      if (res?.code === 0) {
        openWindow({
          url:
            '/iframe?' +
            stringify({
              url,
              name,
              chapterName: item.name
            })
        });
        return;
      }
    }

    // 处理其他类型内容
    router.push({
      path: '/content',
      query: {
        ...params,
        filePath,
        ruleId,
        chapterPath: item.url || item.chapterPath
      }
    });
  }

  function getVideoPath(item: any) {
    return String(item.url || item.chapterPath || '');
  }

  function isResolvingOriginalVideo(item: any) {
    return resolvingVideoPaths.value.includes(getVideoPath(item));
  }

  function getOriginalVideoUrl(item: any) {
    return originalVideoUrls.value[getVideoPath(item)] || '';
  }

  async function resolveOriginalVideo(item: any) {
    const { filePath, ruleId } = route.query;
    const chapterPath = getVideoPath(item);
    if (!chapterPath || isResolvingOriginalVideo(item) || getOriginalVideoUrl(item)) return;
    const requestGeneration = videoRequestGeneration;
    resolvingVideoPaths.value.push(chapterPath);
    try {
      const res = await getContent({
        filePath,
        ruleId,
        chapterPath
      });
      const url = getFirstContentValue(res?.data?.content);
      if (res?.code !== 0 || !url) {
        message.warning('获取视频地址失败！');
        return;
      }

      const videoUrl = new URL(url, window.location.href);
      if (!['http:', 'https:'].includes(videoUrl.protocol)) {
        message.warning('视频地址格式不支持在浏览器中打开');
        return;
      }
      if (requestGeneration === videoRequestGeneration) {
        originalVideoUrls.value[chapterPath] = videoUrl.href;
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取视频地址失败！');
    } finally {
      if (requestGeneration === videoRequestGeneration) {
        resolvingVideoPaths.value = resolvingVideoPaths.value.filter((path) => path !== chapterPath);
      }
    }
  }

  return {
    ruleId,
    showContent,
    resolveOriginalVideo,
    isResolvingOriginalVideo,
    getOriginalVideoUrl,
    findHistory,
    list,
    isChapterCached,
    refreshChapterCacheStatus,
    description,
    loading,
    historys,
    chaptersRef,
    isLastRead,
    ...useFavorites(() => route.query as Record<string, string>)
  };
}
