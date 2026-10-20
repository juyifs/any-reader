import { JSONPath } from 'jsonpath-plus';
import { Analyzer } from './Analyzer';

function parseJson(content: string) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    const number = content.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)?.[0];
    if (number) {
      result += !/[.eE]/.test(number) && !Number.isSafeInteger(Number(number)) ? `"${number}"` : number;
      i += number.length - 1;
      continue;
    }

    result += char;
  }

  return JSON.parse(result);
}

export class AnalyzerJSONPath extends Analyzer {
  _content!: any;

  parse(content: string | any) {
    if (typeof content === 'string') this._content = parseJson(content);
    else this._content = content;
  }

  async getString(rule: string): Promise<string> {
    const val = await this.getElements(rule);
    return Array.isArray(val) ? val.join('  ') : val;
  }

  async getStringList(rule: string): Promise<string[]> {
    return this.getElements(rule);
  }

  async getElements(rule: string) {
    const rows = JSONPath({
      path: rule,
      json: this._content
    });
    if (Array.isArray(rows) && rows.length === 1) return rows[0];

    return rows;
  }
}
