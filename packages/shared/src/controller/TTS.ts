import md5 from 'blueimp-md5';
import { Buffer } from 'node:buffer';
import { Cacheable, Controller, Post } from '../decorators';
import { tts } from '../utils/tts';
import { BaseController } from './BaseController';

interface TTSSettings {
  url?: string;
  endpoint?: string;
  token?: string;
  voice?: string;
  volume?: number | null;
  rate?: number | null;
  pitch?: number | null;
}

export function createTTSRequest(text: string, settings: TTSSettings) {
  const endpoint = settings.url?.trim() || settings.endpoint?.trim();
  if (!endpoint) return null;

  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('TTS 接口地址必须使用 HTTP 或 HTTPS');
  }

  const isLegadoImport = /\/api\/legado-import\/?$/.test(url.pathname);
  if (isLegadoImport) {
    const protocol = url.searchParams.get('protocol')?.trim().toLowerCase();
    if (protocol) {
      if (!['http', 'https'].includes(protocol)) {
        throw new Error('TTS 接口地址必须使用 HTTP 或 HTTPS');
      }
      url.protocol = `${protocol}:`;
    }
    url.pathname = url.pathname.replace(/\/api\/legado-import\/?$/, '/api/text-to-speech');
    url.searchParams.delete('protocol');
  }

  const voice = url.searchParams.get('voice')?.trim() || settings.voice?.trim() || 'zh-CN-XiaoxiaoNeural';
  const token = url.searchParams.get('token')?.trim() || settings.token?.trim();
  url.searchParams.delete('token');
  url.searchParams.set('text', text);
  url.searchParams.set('voice', voice);

  for (const [paramName, value] of Object.entries({
    volume: settings.volume,
    rate: settings.rate,
    pitch: settings.pitch
  })) {
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -100 || value > 100) {
      throw new Error(`TTS ${paramName} 必须是 -100 到 100 之间的数字`);
    }
    url.searchParams.set(paramName, String(value));
  }

  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return { url, headers };
}

@Controller('/tts')
export class TTS extends BaseController {
  @Post('base64')
  @Cacheable({
    cacheKey({ args }) {
      const { text = '', settings = {} } = args[0];
      return `tts@${md5(
        JSON.stringify({
          text,
          url: settings.url,
          endpoint: settings.endpoint,
          token: settings.token,
          voice: settings.voice,
          volume: settings.volume,
          rate: settings.rate,
          pitch: settings.pitch
        })
      )}`;
    }
  })
  async base64({ text, settings }: { text: string; settings?: TTSSettings }) {
    const request = createTTSRequest(text, settings || {});
    if (request) {
      const response = await fetch(request.url, { headers: request.headers });
      if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        throw new Error(`TTS 服务请求失败 (${response.status})${details ? `: ${details}` : ''}`);
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length) throw new Error('TTS 服务未返回音频数据');
      return audio.toString('base64');
    }

    return tts.ttsPromise(text);
  }
}
