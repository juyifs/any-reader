export interface BookChapter {
  name: string;
  chapterPath: string;
  filePath: string;
  chapterHref?: string;
  spineIndex?: number;
}

export interface BookInfo {
  name?: string;
  author?: string;
  cover?: string;
}

export interface IBookParser {
  /**
   * 获取书籍元数据
   */
  getBookInfo(): Promise<BookInfo>;

  /**
   * 获取章节
   */
  getChapter(): Promise<BookChapter[]>;

  /**
   * 获取内容
   * @param item
   */
  getContent(chapterPath: string): Promise<string[]>;
}
