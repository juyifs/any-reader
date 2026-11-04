import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }])
}));

import { fetchPublicImage } from '../../src/image-fetcher';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function webpHeader() {
  const data = Buffer.alloc(12);
  data.write('RIFF', 0, 'ascii');
  data.write('WEBP', 8, 'ascii');
  return data;
}

describe('fetchPublicImage', () => {
  it('recognizes WebP when the origin labels it as generic binary data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(webpHeader(), { headers: { 'content-type': 'application/octet-stream' } }))
    );

    const image = await fetchPublicImage('https://image.example/cover.webp');

    expect(image.contentType).toBe('image/webp');
    expect(image.data).toEqual(webpHeader());
  });

  it('normalizes WebP content types with parameters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(webpHeader(), { headers: { 'content-type': 'image/webp; charset=binary' } }))
    );

    const image = await fetchPublicImage('https://image.example/cover.webp');

    expect(image.contentType).toBe('image/webp');
  });

  it('still rejects non-image responses mislabeled as generic binary data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>not an image</html>', { headers: { 'content-type': 'application/octet-stream' } }))
    );

    await expect(fetchPublicImage('https://image.example/cover.webp')).rejects.toThrow('目标资源不是图片');
  });
});
