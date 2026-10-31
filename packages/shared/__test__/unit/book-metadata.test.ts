import { describe, expect, it } from 'vitest';
import type { BookMetadata } from '../../src/entity/BookMetadata';
import { applyBookMetadata } from '../../src/utils/book-metadata';

function createMetadata(ruleId: string, url: string): BookMetadata {
  return {
    id: 1,
    uid: 0,
    ruleId,
    url,
    name: '手动书名',
    author: '手动作者',
    cover: 'https://example.com/cover.jpg',
    description: '手动简介',
    updateTime: 1
  };
}

describe('book metadata overlays', () => {
  it('overrides local and favorite book information by rule and URL', () => {
    const books = [
      { ruleId: '', url: '/books/book.epub', name: '原书名', author: '', cover: '', description: '' },
      { ruleId: 'rule-1', url: '/book/1', name: '线上书名', author: '', cover: '', description: '' },
      { ruleId: 'rule-2', url: '/book/1', name: '另一来源书名', author: '', cover: '', description: '' }
    ];

    expect(applyBookMetadata(books, [createMetadata('', '/books/book.epub'), createMetadata('rule-1', '/book/1')])).toEqual([
      {
        ...books[0],
        name: '手动书名',
        author: '手动作者',
        cover: 'https://example.com/cover.jpg',
        description: '手动简介'
      },
      {
        ...books[1],
        name: '手动书名',
        author: '手动作者',
        cover: 'https://example.com/cover.jpg',
        description: '手动简介'
      },
      books[2]
    ]);
  });

  it('preserves metadata for books without a saved override', () => {
    const books = [{ ruleId: '', url: '/books/book.txt', name: '文件名', author: '', cover: '', description: '' }];

    expect(applyBookMetadata(books, [])).toEqual(books);
  });
});
