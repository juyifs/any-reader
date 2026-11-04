import { promises as fs } from 'fs';
import path from 'path';
import { Controller, Post } from '../decorators';
import { BaseController } from './BaseController';
import { CACHE_DIR } from '../constants';
import { ensureChapterCacheStorage } from '../utils/chapter-cache';

@Controller('/cache')
export class Cache extends BaseController {
  @Post('clear')
  async clear() {
    await ensureChapterCacheStorage();
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const entries = await fs.readdir(CACHE_DIR);
    await Promise.all(entries.map((entry) => fs.rm(path.join(CACHE_DIR, entry), { recursive: true, force: true })));
  }
}
