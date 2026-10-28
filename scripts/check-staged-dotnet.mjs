import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { relative, resolve } from 'node:path';
import process from 'node:process';

const files = process.argv
  .slice(2)
  .map((file) => relative(process.cwd(), file).replaceAll('\\', '/'));
for (const project of ['apps/api', 'apps/api.tests']) {
  const included = files.filter((file) => file.startsWith(`${project}/`));
  if (!included.length) continue;
  const result = spawnSync(
    'dotnet',
    ['format', 'whitespace', resolve(project), '--verify-no-changes', '--include', ...included],
    { stdio: 'inherit' },
  );
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
