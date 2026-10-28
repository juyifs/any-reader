import md5 from 'blueimp-md5';
import { Buffer } from 'node:buffer';
import { Cacheable, Controller, Post } from '../decorators';
import { tts } from '../utils/tts';
import { BaseController } from './BaseController';

interface TTSSettings {
  endpoint?: string;
  token?: string;
  voice?: string;
  volume?: number | null;
  rate?: number | null;
  pitch?: number | null;
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
          endpoint: settings.endpoint,
          voice: settings.voice,
          volume: settings.volume,
          rate: settings.rate,
          pitch: settings.pitch
        })
      )}`;
    }
  })
  async base64({ text, settings }: { text: string; settings?: TTSSettings }) {
    const endpoint = settings?.endpoint?.trim();
    if (endpoint) {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('TTS 接口地址必须使用 HTTP 或 HTTPS');
      }

      url.searchParams.set('text', text);
      url.searchParams.set('voice', settings?.voice?.trim() || 'zh-CN-XiaoxiaoNeural');
      for (const [paramName, value] of Object.entries({
        volume: settings?.volume,
        rate: settings?.rate,
        pitch: settings?.pitch
      })) {
        if (value === undefined || value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < -100 || value > 100) {
          throw new Error(`TTS ${paramName} 必须是 -100 到 100 之间的数字`);
        }
        url.searchParams.set(paramName, String(value));
      }

      const headers = new Headers();
      const token = settings?.token?.trim();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(url, { headers });
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
