import { Controller, Post } from '../decorators';
import type { BookMetadataInput } from '../service/BookMetadata';
import { BaseController } from './BaseController';

@Controller('/book-metadata')
export class BookMetadataController extends BaseController {
  @Post('update')
  update(data: BookMetadataInput) {
    if (!data || typeof data.url !== 'string' || !data.url.trim()) {
      throw new Error('书籍地址不能为空');
    }

    const fields = ['name', 'author', 'cover', 'description'] as const;
    for (const field of fields) {
      if (typeof data[field] !== 'string') throw new Error(`书籍${field}必须是文本`);
    }

    return this.db.getBookMetadata().update({
      ruleId: typeof data.ruleId === 'string' ? data.ruleId : '',
      url: data.url,
      name: data.name,
      author: data.author,
      cover: data.cover,
      description: data.description
    });
  }
}
