import { request } from '@/utils/request';
import type { ChapterCacheRecord, ChapterCacheIdentity } from '@/utils/chapterCache';
import type { ContentType } from '@any-reader/rule-utils';

export function getServerChapterCache(data: ChapterCacheIdentity & { chapterPath: string }) {
  return request<ChapterCacheRecord | null>({
    method: 'post',
    url: 'chapter-cache/get',
    data,
    showMsg: false
  });
}

export function listServerChapterCache(data: ChapterCacheIdentity) {
  return request<Array<Omit<ChapterCacheRecord, 'content' | 'assets'>>>({
    method: 'post',
    url: 'chapter-cache/list',
    data
  });
}

export function saveServerChapterCache(data: ChapterCacheRecord) {
  return request({
    method: 'post',
    url: 'chapter-cache/save',
    data
  });
}

export function deleteServerChapterCache(data: ChapterCacheIdentity & { chapterPath?: string }) {
  return request<number>({
    method: 'post',
    url: 'chapter-cache/delete',
    data
  });
}

export function exportServerChapterCache(data: ChapterCacheIdentity) {
  return request<ChapterCacheRecord[]>({
    method: 'post',
    url: 'chapter-cache/export',
    data
  });
}

export interface ServerChapterCacheJobStatus {
  id: string;
  state: 'running' | 'completed' | 'cancelled' | 'failed';
  completed: number;
  total: number;
  currentChapterName: string;
  error?: string;
}

export function startServerChapterCacheJob(data: {
  ruleId: string;
  url: string;
  contentType: ContentType;
  chapters: Array<{ chapterPath: string; chapterIndex: number; chapterName: string }>;
}) {
  return request<{ jobId: string }>({
    method: 'post',
    url: 'chapter-cache/job/start',
    data,
    showMsg: false
  });
}

export function getServerChapterCacheJobStatus(jobId: string) {
  return request<ServerChapterCacheJobStatus>({
    method: 'post',
    url: 'chapter-cache/job/status',
    data: { jobId },
    showMsg: false
  });
}

export function stopServerChapterCacheJob(jobId: string) {
  return request<boolean>({
    method: 'post',
    url: 'chapter-cache/job/stop',
    data: { jobId },
    showMsg: false
  });
}
