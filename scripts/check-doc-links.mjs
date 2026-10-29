import { existsSync, readFileSync, readdirSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set([
  '.git',
  'node_modules',
  '.angular',
  '.playwright',
  'artifacts',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  'bin',
  'obj',
  'App_Data',
  'TestResults',
]);
function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}

const failures = [];
let localLinks = 0;
const files = markdownFiles(root);
for (const file of files) {
  const source = readFileSync(file, 'utf8').replace(/```[^\n]*\n[\s\S]*?```/g, '');
  const targets = [
    ...Array.from(source.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g), (match) => match[1]),
    ...Array.from(source.matchAll(/^\s*\[[^\]]+\]:\s*(.+)$/gm), (match) => match[1]),
  ];
  for (const target of targets) {
    const link = target
      .match(/^<([^>]+)>|^(\S+)/)
      ?.slice(1)
      .find(Boolean);
    if (!link || /^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(link)) continue;
    const pathname = link.split(/[?#]/)[0];
    if (!pathname) continue;
    localLinks++;
    try {
      const decoded = decodeURIComponent(pathname);
      const resolved = path.resolve(
        decoded.startsWith('/') ? root : path.dirname(file),
        decoded.replace(/^\//, ''),
      );
      if (!existsSync(resolved)) failures.push(`${path.relative(root, file)} → ${link}`);
    } catch {
      failures.push(`${path.relative(root, file)} → ${link} (invalid path encoding)`);
    }
  }
}
if (failures.length) {
  console.error(`Broken local documentation links (${failures.length}):\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${localLinks} local links across ${files.length} Markdown files; no broken targets.`,
  );
}
