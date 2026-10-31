import { openExplorer } from 'explorer-opener';
import { Controller, Post } from '../decorators';
import { getBookList } from '../utils/book-manager';
import type { BookInfo } from '../utils/BookParser/types';
import { BaseController } from './BaseController';

const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

@Controller('/bookshelf')
export class Bookshelf extends BaseController {
  @Post('list')
  async read() {
    const books = await getBookList(this.app.config.bookDir);
    return await Promise.all(
      books.map(async (book) => {
        let info: BookInfo = {};
        try {
          info = await book.getBookInfo();
        } catch (error) {
          this.analyzerManager.logger.warn(`[本地书籍信息读取失败] ${book.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {
          name: info?.name || book.name,
          author: info?.author || '',
          path: book.path,
          cover: info?.cover
        };
      })
    );
  }

  // vscode, desktop
  @Post('open-dir')
  async openDir() {
    if (isElectron) {
      await openExplorer(this.app.config.bookDir);
    }
  }
}
