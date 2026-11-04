import { ContentType, createRule, type Rule } from './rule';

interface LegacySource {
  [key: string]: unknown;
}

export interface LegadoConversion {
  rule: Rule;
  warnings: string[];
}

function parseRuleObject(value: unknown, field: string): LegacySource {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error(`${field} 不是有效的 JSON`);
    }
  }
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} 格式不受支持`);
  return value as LegacySource;
}

function replaceVariables(value: string) {
  return value.replace(/\{\{\s*(key|page|pageSize)\s*\}\}/gi, (_match, variable: string) => {
    switch (variable.toLowerCase()) {
      case 'key':
        return '$keyword';
      case 'page':
        return '$page';
      case 'pagesize':
        return '$pageSize';
      default:
        return _match;
    }
  });
}

function replaceVariablesInValue(value: unknown): unknown {
  if (typeof value === 'string') return replaceVariables(value);
  if (Array.isArray(value)) return value.map(replaceVariablesInValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceVariablesInValue(item)]));
  }
  return value;
}

function convertUrl(value: unknown, warnings: Set<string>, field: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const url = value.trim();
  const optionsMatch = url.match(/^(.*?)\s*,\s*(\{[\s\S]*\})$/);
  if (!optionsMatch) {
    if (/<js>|@js:|\{\{js\}\}/i.test(url)) warnings.add(`${field} 含有 JavaScript 规则，需手动检查`);
    return replaceVariables(url);
  }

  let options: LegacySource;
  try {
    options = JSON.parse(optionsMatch[2]);
  } catch {
    warnings.add(`${field} 的请求参数无法解析，已保留原始 URL`);
    return replaceVariables(url);
  }

  let headers = options.headers ?? options.header;
  if (typeof headers === 'string') {
    try {
      headers = JSON.parse(headers);
    } catch {
      warnings.add(`${field} 的请求头无法解析，未转换`);
      headers = undefined;
    }
  }
  const targetOptions: LegacySource = {
    url: replaceVariables(optionsMatch[1].trim()),
    method: typeof options.method === 'string' ? options.method.toLowerCase() : 'get'
  };
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) targetOptions.headers = headers;
  else if (headers !== undefined) warnings.add(`${field} 的请求头格式不受支持`);
  if (options.body !== undefined) targetOptions.body = replaceVariablesInValue(options.body);
  for (const key of ['charset', 'type', 'webView', 'webJs', 'js', 'serverID']) {
    if (options[key] !== undefined && options[key] !== null && options[key] !== '') {
      warnings.add(`${field} 的 ${key} 请求选项无法转换`);
    }
  }
  return JSON.stringify(targetOptions);
}

function convertSelector(value: unknown, warnings: Set<string>, field: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const selector = value.trim().replace(/^@(XPath|JSON|CSS):/i, (_match, type: string) => `@${type.toLowerCase()}:`);

  const prefixMatch = selector.match(/^@(css|xpath|json):/);
  const prefix = prefixMatch?.[0] ?? '';
  const body = selector.slice(prefix.length);
  const converted = body
    .replace(/(^|[\s>+~,(])class\.([a-zA-Z_][\w-]*)/g, '$1.$2')
    .replace(/(^|[\s>+~,(])id\.([a-zA-Z_][\w-]*)/g, '$1#$2')
    .replace(/(^|[\s>+~,(])tag\.([a-zA-Z][\w-]*)/g, '$1$2');

  if (/\b(?:children|text)\./.test(body)) warnings.add(`${field} 使用的 Legado 选择器无法自动转换`);
  if (/<js>|@js:|\{\{js\}\}/i.test(selector)) warnings.add(`${field} 含有 JavaScript 规则，需手动检查`);
  return prefix + converted;
}

function convertExploreUrl(value: unknown, warnings: Set<string>): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  return value
    .split(/\n|&&/)
    .map((line) => {
      const parts = line.split('::');
      const url = parts.pop() ?? '';
      parts.push(convertUrl(url, warnings, '发现地址'));
      return parts.join('::');
    })
    .filter((line) => line.trim())
    .join('\n');
}

function getContentType(type: unknown, warnings: Set<string>): ContentType {
  switch (Number(type ?? 0)) {
    case 1:
      return ContentType.AUDIO;
    case 2:
      return ContentType.MANGA;
    case 4:
      return ContentType.VIDEO;
    case 0:
      return ContentType.NOVEL;
    case 3:
      warnings.add('阅读下载类书源没有对应的规则类型，已按小说类型转换');
      return ContentType.NOVEL;
    default:
      warnings.add(`未知的书源类型 ${String(type)}，已按小说类型转换`);
      return ContentType.NOVEL;
  }
}

function convertSource(source: LegacySource): LegadoConversion {
  const warnings = new Set<string>();
  const search = parseRuleObject(source.ruleSearch ?? source.searchRule, 'ruleSearch');
  const bookInfo = parseRuleObject(source.ruleBookInfo ?? source.bookInfoRule, 'ruleBookInfo');
  const toc = parseRuleObject(source.ruleToc ?? source.tocRule, 'ruleToc');
  const content = parseRuleObject(source.ruleContent ?? source.contentRule, 'ruleContent');
  const explore = parseRuleObject(source.ruleExplore ?? source.exploreRule, 'ruleExplore');
  const sourceUrl = typeof source.bookSourceUrl === 'string' ? source.bookSourceUrl.trim() : '';

  if (!sourceUrl) throw new Error(`书源“${source.bookSourceName || '未命名'}”缺少 bookSourceUrl`);
  let host = sourceUrl;
  try {
    const parsedUrl = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported source URL protocol');
    host = parsedUrl.origin;
  } catch {
    warnings.add('书源地址不是有效的 HTTP/HTTPS URL，已原样用作域名');
  }

  if (source.mainJs) warnings.add('此书源使用 mainJs 主脚本，无法转换为字段规则');
  if (source.jsLib || source.loginUrl || source.loginUi || source.loginCheckJs) {
    warnings.add('书源包含脚本库或登录流程，本项目暂不支持');
  }
  if (bookInfo.init || bookInfo.tocUrl) warnings.add('书籍详情页初始化和目录地址提取需要额外请求流程，本项目暂不支持');
  if (bookInfo.name || bookInfo.author || bookInfo.intro || bookInfo.coverUrl || bookInfo.kind || bookInfo.updateTime || bookInfo.wordCount) {
    warnings.add('书籍详情页的名称、作者、简介和封面规则没有对应的转换字段');
  }
  if (search.updateTime || search.wordCount || explore.updateTime || explore.wordCount) {
    warnings.add('搜索或发现规则中的更新时间和字数等扩展字段无法转换');
  }
  if (content.sourceRegex || content.replaceRegex || content.subContent || content.title) {
    warnings.add('正文替换、副内容或标题处理规则无法转换');
  }
  if (toc.isVolume || toc.isVip || toc.isPay || toc.updateTime) {
    warnings.add('目录分卷、付费标记或更新时间规则无法转换');
  }
  if (content.imageDecode) warnings.add('正文图片解密规则无法转换');
  if (content.webJs || toc.preUpdateJs || toc.formatJs || search.checkKeyWord) {
    warnings.add('书源包含额外 JavaScript 处理规则，需手动检查');
  }

  const header = source.header;
  const userAgent = typeof header === 'string' ? (header.trim() ? header : '') : header && typeof header === 'object' ? JSON.stringify(header) : '';
  if (userAgent && !userAgent.trim().startsWith('{')) {
    warnings.add('阅读 3.0 的 header 已写入 userAgent，请检查其是否为本项目支持的请求头 JSON 格式');
  }
  if (source.bookSourceComment) warnings.add('原书源备注没有对应字段，转换后不会保留');

  const enabled = source.enabled !== false && source.enabled !== 0;
  const hasSearch = Boolean(source.searchUrl && search.bookList);
  const exploreUrl = convertExploreUrl(source.exploreUrl, warnings);
  const hasExplore = Boolean(exploreUrl && explore.bookList);
  const rule = createRule({
    name: String(source.bookSourceName || ''),
    host,
    group: String(source.bookSourceGroup || ''),
    author: '',
    contentType: getContentType(source.bookSourceType, warnings),
    sort: Number(source.customOrder) || 0,
    userAgent,
    enableSearch: enabled && hasSearch,
    searchUrl: convertUrl(source.searchUrl, warnings, '搜索地址'),
    searchList: convertSelector(search.bookList, warnings, '搜索列表'),
    searchName: convertSelector(search.name, warnings, '书名'),
    searchAuthor: convertSelector(search.author, warnings, '作者'),
    searchCover: convertSelector(search.coverUrl, warnings, '封面'),
    searchChapter: convertSelector(search.lastChapter, warnings, '最新章节'),
    searchDescription: convertSelector(search.intro, warnings, '简介'),
    searchTags: convertSelector(search.kind, warnings, '搜索分类'),
    searchResult: convertSelector(search.bookUrl, warnings, '书籍地址'),
    chapterList: convertSelector(toc.chapterList, warnings, '目录列表'),
    chapterName: convertSelector(toc.chapterName, warnings, '章节名'),
    chapterResult: convertSelector(toc.chapterUrl, warnings, '章节地址'),
    chapterNextUrl: convertSelector(toc.nextTocUrl, warnings, '目录下一页地址'),
    contentItems: convertSelector(content.content, warnings, '正文内容'),
    contentNextUrl: convertUrl(content.nextContentUrl, warnings, '正文下一页地址'),
    enableDiscover: enabled && source.enabledExplore !== false && source.enabledExplore !== 0 && hasExplore,
    discoverUrl: exploreUrl,
    discoverList: convertSelector(explore.bookList, warnings, '发现列表'),
    discoverName: convertSelector(explore.name, warnings, '发现书名'),
    discoverAuthor: convertSelector(explore.author, warnings, '发现作者'),
    discoverCover: convertSelector(explore.coverUrl, warnings, '发现封面'),
    discoverDescription: convertSelector(explore.intro, warnings, '发现简介'),
    discoverChapter: convertSelector(explore.lastChapter, warnings, '发现最新章节'),
    discoverTags: convertSelector(explore.kind, warnings, '发现分类'),
    discoverResult: convertSelector(explore.bookUrl, warnings, '发现书籍地址')
  });

  if (!enabled) warnings.add('原书源处于禁用状态；转换后的规则也已禁用搜索和发现');
  return { rule, warnings: [...warnings] };
}

export function convertLegadoRules(text: string): LegadoConversion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('书源内容不是有效的 JSON');
  }

  const sources = Array.isArray(parsed) ? parsed : [parsed];
  if (!sources.length || sources.some((source) => !source || typeof source !== 'object' || Array.isArray(source))) {
    throw new Error('请输入阅读 3.0 书源对象或对象数组');
  }
  return sources.map((source) => convertSource(source as LegacySource));
}
