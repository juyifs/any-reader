import type { BookMetadata } from '../entity/BookMetadata';

interface BookIdentity {
  ruleId?: string;
  url?: string;
}

function getKey(ruleId: string | undefined, url: string | undefined) {
  return JSON.stringify([ruleId || '', url || '']);
}

export function applyBookMetadata<T extends BookIdentity>(books: T[], metadata: BookMetadata[]): T[] {
  const metadataByBook = new Map(metadata.map((item) => [getKey(item.ruleId, item.url), item]));

  return books.map((book) => {
    const saved = metadataByBook.get(getKey(book.ruleId, book.url));
    if (!saved) return book;
    return {
      ...book,
      name: saved.name,
      author: saved.author,
      cover: saved.cover,
      description: saved.description
    };
  });
}
