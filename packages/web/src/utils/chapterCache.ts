import type { ContentResponse } from '@any-reader/rule-utils';

export interface ChapterCacheIdentity {
  ruleId: string;
  url: string;
}

export interface ChapterCacheRecord extends ChapterCacheIdentity {
  chapterPath: string;
  chapterIndex: number;
  chapterName: string;
  content: ContentResponse;
  assets: Record<string, Blob | string>;
  updatedAt?: number;
}

const DATABASE_NAME = 'any-reader-chapter-cache';
const STORE_NAME = 'chapters';
const objectUrls = new Map<string, string[]>();

function getRecordKey(identity: ChapterCacheIdentity, chapterPath: string) {
  return JSON.stringify([identity.ruleId, identity.url, chapterPath]);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开浏览器章节缓存失败'));
  });
}

async function runRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('浏览器章节缓存操作失败'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('浏览器章节缓存事务失败'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('浏览器章节缓存事务已中止'));
    };
  });
}

export async function getBrowserChapterCache(identity: ChapterCacheIdentity, chapterPath: string): Promise<ChapterCacheRecord | undefined> {
  const key = getRecordKey(identity, chapterPath);
  return runRequest('readonly', (store) => store.get(key));
}

export async function listBrowserChapterCache(identity: ChapterCacheIdentity): Promise<ChapterCacheRecord[]> {
  const records = (await runRequest('readonly', (store) => store.getAll())) as Array<ChapterCacheRecord & { key: string }>;
  return records.filter((record) => record.ruleId === identity.ruleId && record.url === identity.url);
}

export async function saveBrowserChapterCache(record: ChapterCacheRecord): Promise<void> {
  const key = getRecordKey(record, record.chapterPath);
  await runRequest('readwrite', (store) => store.put({ ...record, key, updatedAt: Date.now() }));
}

export async function deleteBrowserChapterCache(identity: ChapterCacheIdentity, chapterPath?: string): Promise<number> {
  const records = await listBrowserChapterCache(identity);
  const selected = chapterPath ? records.filter((record) => record.chapterPath === chapterPath) : records;
  for (const record of selected) {
    await runRequest('readwrite', (store) => store.delete(getRecordKey(identity, record.chapterPath)));
    releaseCachedChapterAssets(getRecordKey(identity, record.chapterPath));
  }
  return selected.length;
}

export function materializeChapterCache(record: ChapterCacheRecord): ContentResponse {
  const key = getRecordKey(record, record.chapterPath);
  releaseCachedChapterAssets(key);
  const urls: string[] = [];
  const replacements = new Map<string, string>();
  for (const [source, asset] of Object.entries(record.assets || {})) {
    const url = typeof asset === 'string' ? asset : URL.createObjectURL(asset);
    if (typeof asset !== 'string') urls.push(url);
    replacements.set(source, url);
  }
  objectUrls.set(key, urls);

  const content = record.content.content.map((value) => {
    let result = value;
    for (const [source, replacement] of replacements) result = result.split(source).join(replacement);
    return result;
  });
  return { ...record.content, content };
}

export function releaseCachedChapterAssets(key: string) {
  for (const url of objectUrls.get(key) || []) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}

export function getChapterCacheRecordKey(identity: ChapterCacheIdentity, chapterPath: string) {
  return getRecordKey(identity, chapterPath);
}
