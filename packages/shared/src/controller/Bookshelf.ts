import { openExplorer } from 'explorer-opener';
import { Controller, Post } from '../decorators';
import { getBookList } from '../utils/book-manager';
import type { BookInfo } from '../utils/BookParser/types';
import { applyBookMetadata } from '../utils/book-metadata';
import { BaseController } from './BaseController';

const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

@Controller('/bookshelf')
export class Bookshelf extends BaseController {
  @Post('list')
  async read() {
    const books = await getBookList(this.app.config.bookDir);
    const bookList = await Promise.all(
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
          description: info?.description || '',
          path: book.path,
          url: book.path,
          ruleId: '',
          cover: info?.cover || ''
        };
      })
    );
    const metadata = await this.db.getBookMetadata().list();
    return applyBookMetadata(bookList, metadata).map((book) => ({
      name: book.name,
      author: book.author,
      description: book.description,
      path: book.path,
      cover: book.cover
    }));
  }

  // vscode, desktop
  @Post('open-dir')
  async openDir() {
    if (isElectron) {
      await openExplorer(this.app.config.bookDir);
    }
  }
}
