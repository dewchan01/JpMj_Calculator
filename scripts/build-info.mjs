import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = 'unknown';
let dirty = false;
try {
  commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
  dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    encoding: 'utf8',
  }).trim();
} catch {
  /* Source archives may not include Git metadata. */
}
writeFileSync('apps/web/public/version.json', JSON.stringify({ version, commit, dirty }) + '\n');
