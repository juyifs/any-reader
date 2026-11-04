import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir = '';
let chapterCacheDir = '';
let cacheDir = '';
let chapterCacheModule: typeof import('../../src/utils/chapter-cache');
let cacheControllerModule: typeof import('../../src/controller/Cache');

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'any-reader-chapter-cache-'));
  cacheDir = path.join(tempDir, 'cache');
  chapterCacheDir = path.join(tempDir, 'chapter-cache');
  vi.resetModules();
  vi.doMock('../../src/constants', () => ({ CACHE_DIR: cacheDir, CHAPTER_CACHE_DIR: chapterCacheDir }));
  chapterCacheModule = await import('../../src/utils/chapter-cache');
  cacheControllerModule = await import('../../src/controller/Cache');
});

afterEach(async () => {
  vi.doUnmock('../../src/constants');
  vi.resetModules();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('server chapter cache storage', () => {
  it('migrates existing chapter cache records to the separate storage directory', async () => {
    const identity = { ruleId: 'rule-1', url: '/book/1' };
    const legacyDirectory = path.join(cacheDir, 'chapters');
    await fs.mkdir(legacyDirectory, { recursive: true });
    await fs.writeFile(
      path.join(legacyDirectory, 'record.json'),
      JSON.stringify({
        ...identity,
        chapterPath: '/chapter/1',
        chapterIndex: 0,
        chapterName: '第一章',
        content: { content: ['正文'] },
        assets: {},
        updatedAt: 123
      })
    );

    await expect(chapterCacheModule.listChapterCache(identity)).resolves.toMatchObject([{ chapterName: '第一章' }]);
    await expect(fs.readFile(path.join(chapterCacheDir, 'record.json'), 'utf8')).resolves.toContain('"chapterName":"第一章"');
    await expect(fs.stat(legacyDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps chapter cache records when clearing ordinary cache', async () => {
    const legacyDirectory = path.join(cacheDir, 'chapters');
    const ordinaryDirectory = path.join(cacheDir, 'discover');
    await fs.mkdir(legacyDirectory, { recursive: true });
    await fs.mkdir(ordinaryDirectory, { recursive: true });
    await fs.writeFile(path.join(legacyDirectory, 'chapter.json'), '{"chapter":"cached"}');
    await fs.writeFile(path.join(ordinaryDirectory, 'result.json'), '{"result":"cached"}');

    await cacheControllerModule.Cache.prototype.clear.call(Object.create(cacheControllerModule.Cache.prototype));

    await expect(fs.readFile(path.join(chapterCacheDir, 'chapter.json'), 'utf8')).resolves.toBe('{"chapter":"cached"}');
    await expect(fs.stat(ordinaryDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.stat(legacyDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
