import { describe, expect, it } from 'vitest';
import { filterNovelContent, getContentFilterError } from './contentFilter';

describe('content filters', () => {
  it('filters matching plain-text paragraphs case-insensitively', () => {
    expect(filterNovelContent(['正常段落', 'SPONSORED 内容'], ['sponsored'])).toEqual(['正常段落']);
  });

  it('accepts slash-delimited expressions with flags and reports invalid patterns', () => {
    expect(filterNovelContent(['正文', 'SPONSORED 内容'], ['/sponsored/i'])).toEqual(['正文']);
    expect(getContentFilterError('[')).toBeTruthy();
  });
});
