import { message } from 'ant-design-vue';
import { getFavorites, star as _star, unstar as _unstar } from '@/api';
import { deleteServerChapterCache } from '@/api/modules/chapter-cache';
import { deleteBrowserChapterCache } from '@/utils/chapterCache';

export interface FavoriteRow {
  ruleId: string;
  url: string;
}

/**
 * 收藏数据
 */
export const useFavoritesStore = defineStore('favorites', () => {
  // 已收藏列表
  const list = ref<FavoriteRow[]>([]);

  // 是否收藏
  function starred(row: FavoriteRow): boolean {
    return !!list.value.find((e: FavoriteRow) => e.ruleId === row.ruleId && e.url === row.url);
  }

  // 同步收藏列表
  async function sync() {
    const res = await getFavorites();
    if (res?.code === 0) {
      list.value = res.data || [];
    } else {
      list.value = [];
    }
  }

  // 收藏 | 取消收藏
  async function star(row: any) {
    if (starred(row)) {
      await unstar(row);
    } else {
      await _star(row);
      await sync();
    }
  }

  async function unstar(row: any) {
    await _unstar(row);
    await sync();

    const identity = { ruleId: row.ruleId, url: row.url };
    const results = await Promise.allSettled([
      deleteBrowserChapterCache(identity),
      deleteServerChapterCache(identity).then((result) => {
        if (result?.code !== 0) throw new Error(result?.msg || '服务器章节缓存删除失败');
      })
    ]);
    const errors = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
    if (errors.length) {
      console.error('取消收藏后的章节缓存清理失败', errors);
      message.error('已取消收藏，但部分章节缓存删除失败，请在章节缓存管理中重试');
    }
  }

  return {
    list,
    sync,
    star,
    unstar,
    starred
  };
});
