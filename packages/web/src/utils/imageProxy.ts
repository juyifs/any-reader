import { BASE_URL } from '@/constants';

const IMAGE_HEADERS_PATTERN = /@headers?(.+)$/;

export function getImageProxyUrl(value: string) {
  const match = value.match(IMAGE_HEADERS_PATTERN);
  if (!match && !/^https?:\/\//i.test(value)) return value;

  const imageUrl = match ? value.slice(0, match.index) : value;
  const headers = match ? JSON.parse(decodeURIComponent(match[1])) : {};
  const query = new URLSearchParams({
    url: imageUrl,
    headers: JSON.stringify(headers)
  });

  return `${BASE_URL.replace(/\/+$/, '')}/image-proxy?${query.toString()}`;
}
