import { readFile, writeFile } from 'node:fs/promises';
import { log } from 'node:console';
import { URL } from 'node:url';
import { Converter } from 'opencc-js/t2cn';

// zh-TW is maintained by hand; only zh-CN is derived from that source catalog.
const directory = new URL('../apps/web/src/app/core/i18n/', import.meta.url);
const source = JSON.parse(await readFile(new URL('zh-tw.json', directory), 'utf8'));
const convert = Converter({ from: 'tw', to: 'cn' });
const catalog = Object.fromEntries(
  Object.entries(source).map(([key, value]) => [key, convert(value)]),
);
await writeFile(new URL('zh-cn.json', directory), JSON.stringify(catalog, null, 2) + '\n');
log(`Generated ${Object.keys(catalog).length} Simplified Chinese translations from zh-tw.json.`);
