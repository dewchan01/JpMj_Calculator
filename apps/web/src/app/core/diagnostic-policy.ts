export type LogCategory =
  'navigation' | 'network' | 'storage' | 'recognition' | 'room' | 'runtime' | 'configuration';
export type LogLevel = 'info' | 'warn' | 'error';

/** Log operational failures, not normal scoring, form or permission validation. */
export function diagnosticUserMessage(
  message: string,
): { level: LogLevel; category: LogCategory; message: string } | null {
  if (
    ['Could not save match.', 'Could not load match.', 'Could not delete match.'].includes(message)
  )
    return { level: 'error', category: 'storage', message };
  if (message === 'This match changed in another tab. Reopen it before saving.')
    return { level: 'warn', category: 'storage', message: 'Concurrent local update detected.' };
  if (message === 'Could not connect to the online service.')
    return { level: 'warn', category: 'network', message: 'Network request failed.' };
  if (['Detection request failed.', 'Invalid detection response.'].includes(message))
    return { level: 'warn', category: 'recognition', message: 'Photo recognition failed.' };
  return null;
}

/** Defense in depth for fixed diagnostic messages; callers must never pass user content. */
export function redactDiagnostic(message: string): string {
  return message
    .replace(/https?:\/\/[^\s)]+/gi, '[URL]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(
      /\b(?:pin|passcode|token|apiKey|publishableApiKey|authorization)\s*[:=]\s*[^\s,;]+/gi,
      '[credential]',
    )
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email]')
    .replace(/\b[a-f0-9]{8,}\b/gi, '[ID]')
    .replace(/\b\d{6}\b/g, '[code]')
    .slice(0, 1000);
}

export function diagnosticPage(url: string): string {
  const parts = url.split(/[?#]/)[0].split('/').filter(Boolean);
  if (!parts.length) return '/';
  if (!['score', 'room', 'records', 'others', 'settings'].includes(parts[0])) return '/unknown';
  if (
    parts[0] === 'others' &&
    [
      'theme',
      'sound',
      'advanced',
      'language',
      'rules',
      'version',
      'developer',
      'terms',
      'license',
      'import',
      'export',
      'shares',
    ].includes(parts[1])
  )
    return '/others/' + parts[1];
  return '/' + parts[0];
}
