import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { createTTSRequest } from '../../src/controller/TTS';

describe('TTS settings URL', () => {
  it('converts a Legado import URL into a speech request', () => {
    const request = createTTSRequest('你好', {
      url: 'http://tts.testtest.top/api/legado-import?voice=Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)&protocol=https&token=123123',
      volume: null,
      rate: null,
      pitch: null
    });

    expect(request?.url.protocol).toBe('https:');
    expect(request?.url.pathname).toBe('/api/text-to-speech');
    expect(request?.url.searchParams.get('voice')).toBe('Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)');
    expect(request?.url.searchParams.get('text')).toBe('你好');
    expect(request?.url.searchParams.has('token')).toBe(false);
    expect(request?.headers.get('Authorization')).toBe('Bearer 123123');
  });

  it('honors a legacy direct endpoint and its separate settings', () => {
    const request = createTTSRequest('hello', {
      endpoint: 'https://tts.example/api/text-to-speech',
      token: 'legacy-token',
      voice: 'zh-CN-XiaoxiaoNeural',
      volume: 20,
      rate: null,
      pitch: null
    });

    expect(request?.url.searchParams.get('voice')).toBe('zh-CN-XiaoxiaoNeural');
    expect(request?.url.searchParams.get('volume')).toBe('20');
    expect(request?.headers.get('Authorization')).toBe('Bearer legacy-token');
  });
});
