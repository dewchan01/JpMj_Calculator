import { copyFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';
const source = new URL('../dist/web/3rdpartylicenses.txt', import.meta.url);
if (existsSync(source))
  copyFileSync(source, new URL('../dist/web/browser/3rdpartylicenses.txt', import.meta.url));
