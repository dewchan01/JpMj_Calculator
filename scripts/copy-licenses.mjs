import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';
const source = new URL('../dist/web/3rdpartylicenses.txt', import.meta.url);
const icons = new URL('../apps/web/public/icons/yakitori-LICENSE.txt', import.meta.url);
const lucide = new URL('../apps/web/public/icons/lucide-LICENSE.txt', import.meta.url);
const licenses =
  (existsSync(source) ? readFileSync(source, 'utf8') : '') +
  '\n\nYakitori Mahjong marker\n' +
  readFileSync(icons, 'utf8') +
  '\n\nLucide icons\n' +
  readFileSync(lucide, 'utf8');
writeFileSync(new URL('../dist/web/browser/3rdpartylicenses.txt', import.meta.url), licenses);
