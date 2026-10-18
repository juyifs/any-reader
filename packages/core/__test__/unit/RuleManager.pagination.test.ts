import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRule } from '@any-reader/rule-utils';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/analyzer/request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/analyzer/request')>()),
  fetch: fetchMock
}));

import { createAnalyzerManager } from '../../src';
import { RuleManager } from '../../src/analyzer/RuleManager';

describe('RuleManager pagination', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('requests the requested search page when the URL contains $page', async () => {
    fetchMock.mockImplementation(async (params) => ({
      params,
      body: '<div class="item"><a href="/book/2">Second page book</a></div>'
    }));
    const rule = createRule({
      host: 'http://example.test',
      searchUrl: '/search?q=$keyword&page=$page',
      searchList: '.item',
      searchName: 'a@text',
      searchResult: 'a@href'
    });
    const manager = new RuleManager(rule, createAnalyzerManager());

    const result = await manager.search('novel', 2);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0].url).toBe('http://example.test/search?q=novel&page=2');
    expect(result[0].name).toBe('Second page book');
  });

  it('does not request later search pages when the rule has no pagination URL', async () => {
    const rule = createRule({
      host: 'http://example.test',
      searchUrl: '/search?q=$keyword'
    });
    const manager = new RuleManager(rule, createAnalyzerManager());

    expect(await manager.search('novel', 2)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows the discovered next-page URL on the requested page', async () => {
    fetchMock.mockImplementation(async (params) => ({
      params,
      body: params.url.endsWith('/catalog/1')
        ? '<div class="item"><a href="/book/1">First book</a></div><a class="next" href="/catalog/2">Next</a>'
        : '<div class="item"><a href="/book/2">Second book</a></div>'
    }));
    const rule = createRule({
      host: 'http://example.test',
      discoverList: '.item',
      discoverName: 'a@text',
      discoverResult: 'a@href',
      discoverNextUrl: '.next@href'
    });
    const manager = new RuleManager(rule, createAnalyzerManager());

    await manager.discover('/catalog/1');
    const result = await manager.discover('/catalog/1', 2);

    expect(fetchMock.mock.calls.map(([params]) => params.url)).toEqual(['http://example.test/catalog/1', 'http://example.test/catalog/2']);
    expect(result[0].name).toBe('Second book');
  });

  it('substitutes the requested page in discovery URLs containing $page', async () => {
    fetchMock.mockImplementation(async (params) => ({
      params,
      body: '<div class="item"><a href="/book/2">Second book</a></div>'
    }));
    const rule = createRule({
      host: 'http://example.test',
      discoverList: '.item',
      discoverName: 'a@text',
      discoverResult: 'a@href'
    });
    const manager = new RuleManager(rule, createAnalyzerManager());

    const result = await manager.discover('/catalog?page=$page', 2);

    expect(fetchMock.mock.calls[0][0].url).toBe('http://example.test/catalog?page=2');
    expect(result[0].name).toBe('Second book');
  });
});
