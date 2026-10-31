import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 5;

export class InvalidImageRefererError extends Error {}

function isPrivateIpv4(address: string) {
  const octets = address.split('.').map(Number);
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPublicIpv6(address: string) {
  const parts = address.toLowerCase().split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const words = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right].map((part) => Number.parseInt(part || '0', 16));
  if (words.length !== 8 || words.some((word) => !Number.isFinite(word))) return false;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return !isPrivateIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  const value = words.reduce((result, word) => (result << 16n) | BigInt(word), 0n);
  return value >> 125n === 1n && value >> 96n !== 0x20010db8n;
}

async function assertPublicUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('图片地址无效');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('图片地址协议不受支持');

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('不允许访问本地地址');

  const ipVersion = isIP(hostname);
  const addresses = ipVersion ? [{ address: hostname, family: ipVersion }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address, family }) => (family === 4 ? isPrivateIpv4(address) : !isPublicIpv6(address)))) {
    throw new Error('不允许访问非公网地址');
  }
  return url;
}

export async function fetchPublicImage(imageUrl: string, suppliedHeaders: Record<string, unknown> = {}, signal?: AbortSignal) {
  const headers = new Headers();
  for (const name of ['Referer', 'User-Agent']) {
    const value = suppliedHeaders[name] ?? suppliedHeaders[name.toLowerCase()];
    if (typeof value === 'string') headers.set(name, value);
  }
  const referer = headers.get('Referer');
  if (referer) {
    try {
      await assertPublicUrl(referer);
    } catch {
      throw new InvalidImageRefererError('Invalid Referer');
    }
  }

  let target = await assertPublicUrl(imageUrl);
  let response: Response | undefined;
  for (let redirects = 0; redirects <= MAX_IMAGE_REDIRECTS; redirects++) {
    response = await fetch(target, {
      headers,
      redirect: 'manual',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location || redirects === MAX_IMAGE_REDIRECTS) throw new Error('图片重定向次数过多');
    target = await assertPublicUrl(new URL(location, target).toString());
  }

  if (!response?.ok) throw new Error(`图片服务器返回 ${response?.status ?? '未知状态'}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) throw new Error('目标资源不是图片');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) throw new Error('图片文件过大');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('图片响应为空');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size <= MAX_IMAGE_SIZE) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_SIZE) {
      await reader.cancel();
      throw new Error('图片文件过大');
    }
    chunks.push(value);
  }
  return { data: Buffer.concat(chunks), contentType };
}
