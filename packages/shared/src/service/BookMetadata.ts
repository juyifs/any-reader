import type { Repository } from 'typeorm';
import type { BookMetadata } from '../entity/BookMetadata';

export interface BookMetadataInput {
  ruleId: string;
  url: string;
  name: string;
  author: string;
  cover: string;
  description: string;
}

export class BookMetadataService {
  repository: Repository<BookMetadata>;

  constructor(repository: Repository<BookMetadata>) {
    this.repository = repository;
  }

  list() {
    return this.repository.find();
  }

  async update(data: BookMetadataInput) {
    let metadata = await this.repository.findOneBy({
      uid: 0,
      ruleId: data.ruleId,
      url: data.url
    });

    if (metadata) {
      Object.assign(metadata, data);
    } else {
      metadata = this.repository.create({
        uid: 0,
        ...data
      });
    }

    metadata.updateTime = Date.now();
    return this.repository.save(metadata);
  }
}
