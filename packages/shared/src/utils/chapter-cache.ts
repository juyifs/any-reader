import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import md5 from 'blueimp-md5';
import type { ContentResponse } from '@any-reader/rule-utils';
import { CACHE_DIR } from '../constants';

const CHAPTER_CACHE_DIR = path.join(CACHE_DIR, 'chapters');
const MAX_CHAPTER_CACHE_BYTES = 50 * 1024 * 1024;

export interface ChapterCacheIdentity {
  ruleId: string;
  url: string;
}

export interface ChapterCacheRecord extends ChapterCacheIdentity {
  chapterPath: string;
  chapterIndex: number;
  chapterName: string;
  content: ContentResponse;
  assets: Record<string, string>;
  updatedAt: number;
}

function getCacheFile(identity: ChapterCacheIdentity, chapterPath: string) {
  const key = md5(JSON.stringify([identity.ruleId, identity.url, chapterPath]));
  return path.join(CHAPTER_CACHE_DIR, `${key}.json`);
}

function matchesBook(record: ChapterCacheRecord, identity: ChapterCacheIdentity) {
  return record.ruleId === identity.ruleId && record.url === identity.url;
}

export async function getChapterCache(identity: ChapterCacheIdentity, chapterPath: string): Promise<ChapterCacheRecord | undefined> {
  const file = getCacheFile(identity, chapterPath);
  try {
    const record = JSON.parse(await fs.readFile(file, 'utf8')) as ChapterCacheRecord;
    return matchesBook(record, identity) && record.chapterPath === chapterPath ? record : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function listChapterCache(identity: ChapterCacheIdentity): Promise<Omit<ChapterCacheRecord, 'content' | 'assets'>[]> {
  let files: string[];
  try {
    files = await fs.readdir(CHAPTER_CACHE_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        try {
          const record = JSON.parse(await fs.readFile(path.join(CHAPTER_CACHE_DIR, file), 'utf8')) as ChapterCacheRecord;
          if (!matchesBook(record, identity)) return undefined;
          const { content: _content, assets: _assets, ...metadata } = record;
          return metadata;
        } catch (error) {
          throw new Error(`读取章节缓存失败 (${file}): ${error instanceof Error ? error.message : String(error)}`);
        }
      })
  );
  return records
    .filter((record): record is Omit<ChapterCacheRecord, 'content' | 'assets'> => !!record)
    .sort((a, b) => a.chapterIndex - b.chapterIndex || a.chapterPath.localeCompare(b.chapterPath));
}

export async function saveChapterCache(record: Omit<ChapterCacheRecord, 'updatedAt'>): Promise<ChapterCacheRecord> {
  if (!record.ruleId || !record.url || !record.chapterPath) throw new Error('书源、书籍和章节信息不能为空');
  if (!Number.isInteger(record.chapterIndex) || record.chapterIndex < 0 || !record.chapterName) throw new Error('章节元数据无效');
  if (!Array.isArray(record.content?.content) || !record.assets || typeof record.assets !== 'object') throw new Error('章节缓存数据格式无效');
  if (Object.values(record.assets).some((asset) => typeof asset !== 'string' || !/^data:image\/[a-z0-9.+-]+;base64,/i.test(asset))) {
    throw new Error('章节缓存图片格式无效');
  }
  const size = Buffer.byteLength(JSON.stringify(record));
  if (size > MAX_CHAPTER_CACHE_BYTES) throw new Error('单章缓存超过 50 MB 限制');

  const result: ChapterCacheRecord = {
    ...record,
    updatedAt: Date.now()
  };
  await fs.mkdir(CHAPTER_CACHE_DIR, { recursive: true });
  const file = getCacheFile(record, record.chapterPath);
  const tempFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(result), 'utf8');
  await fs.rename(tempFile, file);
  return result;
}

export async function deleteChapterCache(identity: ChapterCacheIdentity, chapterPath?: string): Promise<number> {
  const records = chapterPath ? [{ chapterPath }] : await listChapterCache(identity);
  let removed = 0;
  for (const record of records) {
    try {
      await fs.unlink(getCacheFile(identity, record.chapterPath));
      removed++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return removed;
}

export async function exportChapterCache(identity: ChapterCacheIdentity): Promise<ChapterCacheRecord[]> {
  const records = await listChapterCache(identity);
  const result = await Promise.all(records.map((record) => getChapterCache(identity, record.chapterPath)));
  return result.filter((record): record is ChapterCacheRecord => !!record);
}
