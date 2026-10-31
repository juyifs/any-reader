import { randomUUID } from 'node:crypto';
import { createRuleManager } from '@any-reader/core';
import { ContentType, getChapterCache, saveChapterCache, type App, type ContentResponse } from '@any-reader/shared';
import { fetchPublicImage } from './image-fetcher';

type CacheJobChapter = {
  chapterPath: string;
  chapterIndex: number;
  chapterName: string;
};

type CacheJobState = 'running' | 'completed' | 'cancelled' | 'failed';

type CacheJob = {
  id: string;
  ruleId: string;
  url: string;
  state: CacheJobState;
  completed: number;
  total: number;
  currentChapterName: string;
  createdAt: number;
  error?: string;
  cancelled: boolean;
  cancelWait?: () => void;
  activeController?: AbortController;
};

const jobs = new Map<string, CacheJob>();

function wait(job: CacheJob, milliseconds: number) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      if (job.cancelWait === finish) job.cancelWait = undefined;
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    job.cancelWait = finish;
  });
}

function resolveImage(value: string, host: string) {
  const marker = value.match(/@headers?(.+)$/);
  const source = marker ? value.slice(0, marker.index) : value;
  const url = new URL(source, host).toString();
  let headers: Record<string, unknown> = {};
  if (marker) {
    try {
      headers = JSON.parse(decodeURIComponent(marker[1]));
    } catch {
      throw new Error('漫画图片请求头格式无效');
    }
  }
  return { url, headers };
}

function throwIfCancelled(job: CacheJob) {
  if (job.cancelled) throw new Error('缓存任务已取消');
}

async function cacheOneChapter(app: App, job: CacheJob, chapter: CacheJobChapter, contentType: ContentType) {
  const existing = await getChapterCache({ ruleId: job.ruleId, url: job.url }, chapter.chapterPath);
  if (existing) return false;
  const rule = await app.db.getResourceRule().findById(job.ruleId);
  if (!rule) throw new Error('书源不存在');
  const manager = createRuleManager(rule, app.analyzerManager);
  let content = await manager.getContent(chapter.chapterPath);
  if (typeof content === 'string') content = [content];
  if (!Array.isArray(content) || !content.length) throw new Error(`获取章节内容失败：${chapter.chapterName}`);

  if (rule.contentDecoder) {
    content = await Promise.all(content.map((item: string) => manager.contentDecoder(item)));
  }
  throwIfCancelled(job);

  const response: ContentResponse = {
    contentType,
    content: content as string[],
    contentDecoder: false
  };
  const assets: Record<string, string> = {};
  if (contentType === ContentType.MANGA) {
    const images = [...new Set(response.content)];
    for (let index = 0; index < images.length; index++) {
      throwIfCancelled(job);
      const source = images[index];
      const { url, headers } = resolveImage(source, rule.host);
      const controller = new AbortController();
      job.activeController = controller;
      let image: Awaited<ReturnType<typeof fetchPublicImage>>;
      try {
        image = await fetchPublicImage(url, headers, controller.signal);
      } finally {
        if (job.activeController === controller) job.activeController = undefined;
      }
      throwIfCancelled(job);
      const mimeType = image.contentType.split(';', 1)[0];
      assets[source] = `data:${mimeType};base64,${image.data.toString('base64')}`;
      if (index < images.length - 1) await wait(job, 5000);
    }
  }
  throwIfCancelled(job);
  await saveChapterCache({
    ruleId: job.ruleId,
    url: job.url,
    chapterPath: chapter.chapterPath,
    chapterIndex: chapter.chapterIndex,
    chapterName: chapter.chapterName,
    content: response,
    assets
  });
  return true;
}

async function runJob(app: App, job: CacheJob, chapters: CacheJobChapter[], contentType: ContentType) {
  try {
    for (let index = 0; index < chapters.length; index++) {
      throwIfCancelled(job);
      const chapter = chapters[index];
      job.currentChapterName = chapter.chapterName;
      const fetched = await cacheOneChapter(app, job, chapter, contentType);
      job.completed++;
      if (fetched && index < chapters.length - 1) await wait(job, 30000);
    }
    job.state = job.cancelled ? 'cancelled' : 'completed';
  } catch (error) {
    job.state = job.cancelled ? 'cancelled' : 'failed';
    if (!job.cancelled) job.error = error instanceof Error ? error.message : String(error);
  } finally {
    job.currentChapterName = '';
    job.cancelWait = undefined;
  }
}

export function startChapterCacheJob(app: App, data: { ruleId: string; url: string; contentType: ContentType; chapters: CacheJobChapter[] }) {
  if (!data.ruleId || !data.url) throw new Error('书源和书籍信息不能为空');
  if (![ContentType.MANGA, ContentType.NOVEL].includes(data.contentType)) throw new Error('仅支持缓存小说和漫画');
  if (!Array.isArray(data.chapters) || !data.chapters.length || data.chapters.length > 10000) throw new Error('缓存章节列表无效');
  if (data.chapters.some((chapter) => !chapter.chapterPath || !chapter.chapterName || !Number.isInteger(chapter.chapterIndex))) {
    throw new Error('章节信息无效');
  }
  const id = randomUUID();
  for (const [jobId, existing] of jobs) {
    if (existing.state !== 'running' && Date.now() - existing.createdAt > 24 * 60 * 60 * 1000) jobs.delete(jobId);
  }
  if ([...jobs.values()].some((existing) => existing.state === 'running' && existing.ruleId === data.ruleId && existing.url === data.url)) {
    throw new Error('该书已有正在运行的服务器缓存任务');
  }
  const job: CacheJob = {
    id,
    ruleId: data.ruleId,
    url: data.url,
    state: 'running',
    completed: 0,
    total: data.chapters.length,
    currentChapterName: '',
    createdAt: Date.now(),
    cancelled: false
  };
  jobs.set(id, job);
  void runJob(app, job, data.chapters, data.contentType);
  return { jobId: id };
}

export function getChapterCacheJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  const { cancelled: _cancelled, cancelWait: _cancelWait, activeController: _activeController, ...status } = job;
  return status;
}

export function stopChapterCacheJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.state === 'running') {
    job.cancelled = true;
    job.cancelWait?.();
    job.activeController?.abort();
  }
  return true;
}
