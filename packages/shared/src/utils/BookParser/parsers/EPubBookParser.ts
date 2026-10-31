import EPub from '@any-reader/epub';
import type { BookChapter, BookInfo, IBookParser } from '../types';
import { BaseBookParser } from './BaseBookParser';

export default class EPubBookParser extends BaseBookParser implements IBookParser {
  public getBookInfo(): Promise<BookInfo> {
    return new Promise((resolve, reject) => {
      const book = new EPub(this.filePath);
      book.on('end', () => {
        const info: BookInfo = {
          name: book.metadata.title || undefined,
          author: book.metadata.creator || undefined
        };
        const coverId =
          book.metadata['cover-image'] ||
          book.metadata.cover ||
          Object.keys(book.manifest).find((id) => book.manifest[id].properties?.split(/\s+/).includes('cover-image'));
        if (!coverId) {
          resolve(info);
          return;
        }

        book.getImage(coverId, (error: Error | null, data: Buffer, mediaType: string) => {
          if (error) {
            reject(error);
            return;
          }
          info.cover = `data:${mediaType};base64,${data.toString('base64')}`;
          resolve(info);
        });
      });
      book.on('error', reject);
      book.parse();
    });
  }

  /**
   * 读取 EPUB spine 里的章节列表，并保留章节 href 和 spine 顺序用于 annotation 定位。
   */
  public getChapter(): Promise<BookChapter[]> {
    return new Promise((resolve, reject) => {
      const book = new EPub(this.filePath);
      book.on('end', () => {
        resolve(
          book.flow.map((e: any, spineIndex: number) => {
            return {
              name: e.title || e.id,
              chapterPath: e.id,
              filePath: this.filePath,
              chapterHref: e.href,
              spineIndex
            };
          })
        );
      });
      book.on('error', (err: any) => {
        reject(err);
      });
      book.parse();
    });
  }

  /**
   * 读取指定章节正文，返回可直接渲染的 XHTML body 内容。
   */
  public getContent(chapterPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const book = new EPub(this.filePath);
      book.on('end', () => {
        book.getChapter(chapterPath, (error: any, text: string) => {
          if (error) reject(error);

          resolve([text]);
        });
      });
      book.parse();
    });
  }
}
