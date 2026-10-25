import { Service, signal } from '@angular/core';

@Service()
export class BuildInfo {
  readonly value = signal({ version: '0.1.0', commit: 'unknown', dirty: false });
  constructor() {
    void fetch(new URL('version.json', document.baseURI))
      .then(async (response) => {
        if (!response.ok) return;
        const value: unknown = await response.json();
        if (
          typeof value === 'object' &&
          value !== null &&
          'version' in value &&
          typeof value.version === 'string' &&
          'commit' in value &&
          typeof value.commit === 'string'
        )
          this.value.set({
            version: value.version,
            commit: value.commit,
            dirty: 'dirty' in value && value.dirty === true,
          });
      })
      .catch(() => {
        /* Build information is optional when offline. */
      });
  }
}
