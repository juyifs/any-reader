import { Controller, Post } from '../decorators';
import { deleteChapterCache, exportChapterCache, getChapterCache, listChapterCache, saveChapterCache } from '../utils/chapter-cache';
import { BaseController } from './BaseController';

interface CacheIdentity {
  ruleId: string;
  url: string;
}

@Controller('/chapter-cache')
export class ChapterCache extends BaseController {
  @Post('get')
  get(data: CacheIdentity & { chapterPath: string }) {
    return getChapterCache(data, data.chapterPath);
  }

  @Post('list')
  list(data: CacheIdentity) {
    return listChapterCache(data);
  }

  @Post('save')
  async save(data: Parameters<typeof saveChapterCache>[0]) {
    const record = await saveChapterCache(data);
    return { chapterPath: record.chapterPath, updatedAt: record.updatedAt };
  }

  @Post('delete')
  delete(data: CacheIdentity & { chapterPath?: string }) {
    return deleteChapterCache(data, data.chapterPath);
  }

  @Post('export')
  export(data: CacheIdentity) {
    return exportChapterCache(data);
  }
}
