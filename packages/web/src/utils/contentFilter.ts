const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;
const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, div, section, article';

export function createContentFilter(pattern: string): RegExp {
  const value = pattern.trim();
  const slashDelimited = value.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  if (slashDelimited) return new RegExp(slashDelimited[1], slashDelimited[2]);

  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escapedValue, 'i');
}

export function getContentFilterError(pattern: string): string {
  try {
    createContentFilter(pattern);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function matchesAny(text: string, filters: RegExp[]) {
  return filters.some((filter) => {
    filter.lastIndex = 0;
    return filter.test(text);
  });
}

function filterHtmlContent(html: string, filters: RegExp[]): string | undefined {
  const container = document.createElement('template');
  container.innerHTML = html;
  const blocks = Array.from(container.content.querySelectorAll(BLOCK_SELECTOR));
  let removedBlock = false;

  for (const block of blocks) {
    if (block.querySelector(BLOCK_SELECTOR) || !matchesAny(block.textContent || '', filters)) continue;
    block.remove();
    removedBlock = true;
  }

  if (matchesAny(container.content.textContent || '', filters)) return undefined;
  return removedBlock ? container.innerHTML : html;
}

export function filterNovelContent(content: string[], patterns: string[]): string[] {
  const filters = patterns
    .filter((pattern) => pattern.trim())
    .map((pattern) => {
      try {
        return createContentFilter(pattern);
      } catch {
        return null;
      }
    })
    .filter((filter): filter is RegExp => filter !== null);

  if (!filters.length) return content;

  const filteredContent: string[] = [];
  for (const item of content) {
    if (!HTML_TAG_PATTERN.test(item)) {
      if (!matchesAny(item, filters)) filteredContent.push(item);
      continue;
    }

    const filteredItem = filterHtmlContent(item, filters);
    if (filteredItem !== undefined) filteredContent.push(filteredItem);
  }
  return filteredContent;
}
