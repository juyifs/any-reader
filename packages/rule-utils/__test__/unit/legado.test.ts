import { describe, expect, it } from 'vitest';
import { ContentType } from '../../src/rule';
import { convertLegadoRules } from '../../src/legado';

describe('Legado 3.0 source conversion', () => {
  it('converts a basic source and its nested rule objects', () => {
    const [converted] = convertLegadoRules(
      JSON.stringify({
        bookSourceUrl: 'https://example.com/',
        bookSourceName: 'Example',
        bookSourceGroup: '测试',
        bookSourceType: 0,
        enabled: true,
        searchUrl: 'https://example.com/search?q={{key}}&page={{page}}',
        ruleSearch: {
          bookList: 'class.result',
          name: 'class.title@text',
          author: 'class.author@text',
          intro: 'class.intro@text',
          lastChapter: 'class.latest@text',
          coverUrl: 'class.cover@src',
          bookUrl: 'class.title@href'
        },
        ruleToc: {
          chapterList: 'class.chapter',
          chapterName: 'class.title@text',
          chapterUrl: 'class.title@href',
          nextTocUrl: 'class.next@href'
        },
        ruleContent: {
          content: 'id.content@html',
          nextContentUrl: 'class.next@href'
        },
        header: { 'User-Agent': 'Example' }
      })
    );

    expect(converted.rule.name).toBe('Example');
    expect(converted.rule.host).toBe('https://example.com');
    expect(converted.rule.group).toBe('测试');
    expect(converted.rule.contentType).toBe(ContentType.NOVEL);
    expect(converted.rule.searchUrl).toBe('https://example.com/search?q=$keyword&page=$page');
    expect(converted.rule.searchList).toBe('.result');
    expect(converted.rule.searchName).toBe('.title@text');
    expect(converted.rule.searchResult).toBe('.title@href');
    expect(converted.rule.chapterList).toBe('.chapter');
    expect(converted.rule.chapterNextUrl).toBe('.next@href');
    expect(converted.rule.contentItems).toBe('#content@html');
    expect(converted.rule.userAgent).toBe('{"User-Agent":"Example"}');
    expect(converted.warnings).toEqual([]);
  });

  it('converts request options, discovery URLs, and JSON-encoded nested rules', () => {
    const [converted] = convertLegadoRules(
      JSON.stringify({
        bookSourceUrl: 'https://example.com',
        bookSourceName: 'POST source',
        bookSourceType: 2,
        searchUrl: 'https://example.com/search, {"method":"POST","headers":{"x-key":"yes"},"body":{"keyword":"{{key}}"}}',
        ruleSearch: JSON.stringify({ bookList: 'tag.li', name: 'tag.a@text', bookUrl: 'tag.a@href', kind: 'class.genre@text' }),
        enabledExplore: true,
        exploreUrl: '分类::https://example.com/list?page={{page}}',
        ruleExplore: { bookList: 'class.book', name: 'class.name@text', bookUrl: 'class.name@href', kind: 'class.genre@text' }
      })
    );

    expect(converted.rule.contentType).toBe(ContentType.MANGA);
    expect(JSON.parse(converted.rule.searchUrl)).toEqual({
      url: 'https://example.com/search',
      method: 'post',
      headers: { 'x-key': 'yes' },
      body: { keyword: '$keyword' }
    });
    expect(converted.rule.searchList).toBe('li');
    expect(converted.rule.searchTags).toBe('.genre@text');
    expect(converted.rule.discoverUrl).toBe('分类::https://example.com/list?page=$page');
    expect(converted.rule.discoverList).toBe('.book');
    expect(converted.rule.discoverTags).toBe('.genre@text');
    expect(converted.rule.enableDiscover).toBe(true);
  });

  it('reports fields and rule syntax that cannot be represented', () => {
    const [converted] = convertLegadoRules(
      JSON.stringify({
        bookSourceUrl: 'https://example.com',
        bookSourceName: 'Advanced',
        bookSourceType: 3,
        mainJs: 'fetchSomething()',
        ruleBookInfo: { init: 'some js', tocUrl: 'a@href', author: 'a@text' },
        ruleContent: { content: 'id.content@text', imageDecode: 'decrypt()' },
        ruleSearch: { bookList: 'children.0', name: 'text.title@text' }
      })
    );

    expect(converted.warnings).toContain('此书源使用 mainJs 主脚本，无法转换为字段规则');
    expect(converted.warnings).toContain('书籍详情页初始化和目录地址提取需要额外请求流程，本项目暂不支持');
    expect(converted.warnings).toContain('正文图片解密规则无法转换');
    expect(converted.warnings).toContain('搜索列表 使用的 Legado 选择器无法自动转换');
    expect(converted.rule.contentType).toBe(ContentType.NOVEL);
  });

  it('rejects invalid input and sources without a source URL', () => {
    expect(() => convertLegadoRules('not json')).toThrow('书源内容不是有效的 JSON');
    expect(() => convertLegadoRules(JSON.stringify({ bookSourceName: 'Missing URL' }))).toThrow('缺少 bookSourceUrl');
    expect(() => convertLegadoRules(JSON.stringify({ bookSourceUrl: 'https://example.com', ruleSearch: '{' }))).toThrow('ruleSearch 不是有效的 JSON');
  });
});
