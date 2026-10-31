import { Controller, Post } from '../decorators';
import { applyBookMetadata } from '../utils/book-metadata';
import { BaseController } from './BaseController';

@Controller('/resource-favorites')
export class ResourceFavorites extends BaseController {
  // 获取列表
  @Post('list')
  async list() {
    const [favorites, metadata] = await Promise.all([this.db.getResourceFavorites().list(), this.db.getBookMetadata().list()]);
    return applyBookMetadata(favorites, metadata);
  }

  // 删除
  @Post('unstar')
  unstar(data: any) {
    return this.db.getResourceFavorites().remove(data);
  }

  // 添加
  @Post('star')
  star(data: any) {
    return this.db.getResourceFavorites().create(data);
  }
}
