import { request } from '@/utils/request';

export function updateBookMetadata(data: { ruleId: string; url: string; name: string; author: string; cover: string; description: string }) {
  return request({
    method: 'post',
    url: 'book-metadata/update',
    data
  });
}
