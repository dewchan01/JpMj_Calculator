import { describe, expect, it } from 'vitest';
import { diagnosticPage, diagnosticUserMessage, redactDiagnostic } from './diagnostic-policy';

describe('diagnostic privacy and classification', () => {
  it('keeps expected validation out of the system log', () => {
    for (const message of [
      'Enter a winning hand.',
      'This action is not permitted by the host.',
      'Choose an image file.',
      'player Alice: invalid tile',
    ])
      expect(diagnosticUserMessage(message)).toBeNull();
    expect(diagnosticUserMessage('Could not save match.')).toMatchObject({
      level: 'error',
      category: 'storage',
    });
    expect(diagnosticUserMessage('Could not connect to the online service.')).toMatchObject({
      level: 'warn',
      category: 'network',
    });
  });
  it('redacts credentials, identifiers, links and email addresses', () => {
    const value = redactDiagnostic(
      'https://host/secret?pin=123456 Bearer abcdefgh token=private 123456 deadbeef00 user@example.com',
    );
    for (const secret of [
      'host',
      '123456',
      'abcdefgh',
      'private',
      'deadbeef00',
      'user@example.com',
    ])
      expect(value).not.toContain(secret);
  });
  it('only records static route names', () => {
    expect(diagnosticPage('/room/ABC123?pin=secret')).toBe('/room');
    expect(diagnosticPage('/records/user-private-id')).toBe('/records');
    expect(diagnosticPage('/others/sound')).toBe('/others/sound');
    expect(diagnosticPage('/private-user-name')).toBe('/unknown');
  });
});
