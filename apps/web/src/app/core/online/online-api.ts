import { Service, signal, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { AppConfiguration } from '../config/app-config';
import { DiagnosticLog } from '../diagnostic-log';

export interface ShareReceipt {
  id: string;
  deletionSecret: string;
  expiresAt: string;
}
export interface RoomAccess {
  id: string;
  token: string;
  host: boolean;
  seat: number | null;
  pin?: string;
}
export interface RoomState {
  matchName?: string | null;
  pendingMatch?: import('../../../../../../packages/mahjong-core/ledger').Match | null;
  assignment?: string | null;
  closed?: boolean;
  started?: boolean;
  host?: boolean;
  unassigned?: { id: string; requestedSeat: number | null; decision?: string }[] | null;
  ruleLabel?: string | null;
  gameLength?: 'east' | 'south' | null;
  playerNames?: string[] | null;
  id: string;
  playerCount: number;
  revision: number;
  seats: number[];
  ownSeat?: number | null;
  expiresAt: string;
}

@Service()
export class OnlineApi {
  clearRoomAccess(id: string, token: string): void {
    const key = `riichi-room:${this.url()}`;
    for (const name of ['sessionStorage', 'localStorage'] as const) {
      try {
        const storage = window[name];
        const saved = JSON.parse(storage.getItem(key) ?? 'null');
        if (saved?.id === id && saved?.token === token) {
          storage.removeItem(key);
          if (name === 'sessionStorage') storage.removeItem(`${key}:${id}:pin`);
        }
      } catch {
        /* Storage may be unavailable. */
      }
    }
  }
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly configuration = inject(AppConfiguration);
  private readonly logs = inject(DiagnosticLog);
  readonly url = signal('');
  readonly ready = this.configure();

  private async configure(): Promise<void> {
    try {
      const settings = await this.configuration.ready;
      const config: unknown =
        settings && typeof settings === 'object' && 'backend' in settings ? settings.backend : null;
      if (
        !config ||
        typeof config !== 'object' ||
        !('apiUrl' in config) ||
        typeof config.apiUrl !== 'string' ||
        !config.apiUrl
      )
        return;
      const url = new URL(config.apiUrl);
      if (
        url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      )
        return;
      if (url.username || url.password || url.search || url.hash) return;
      this.url.set(url.href.replace(/\/$/, ''));
    } catch {
      this.logs.add('warn', 'Online configuration is invalid.', 'configuration');
    }
  }

  async request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    await this.ready;
    if (!this.url()) throw new Error('Online service is not configured.');
    let response: Response;
    try {
      response = await fetch(this.url() + path, {
        method,
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      this.logs.add('warn', 'Network request failed.', 'network');
      throw new Error('Could not connect to the online service.');
    }
    if (!response.ok) {
      const roomRead = /^\/api\/rooms\/([a-f0-9]{10})(?:\/game)?(?:\?.*)?$/i.exec(path);
      if (method === 'GET' && token && roomRead && [401, 404, 410].includes(response.status))
        this.clearRoomAccess(roomRead[1], token);
      if (response.status === 409) {
        const detail: unknown = await response.json().catch(() => null);
        if (detail && typeof detail === 'object' && 'code' in detail && detail.code === 'room-full')
          throw new Error('This room is full.');
        if (
          detail &&
          typeof detail === 'object' &&
          'code' in detail &&
          detail.code === 'unassigned-players'
        )
          throw new Error('Assign all waiting players before starting the game.');
        if (
          detail &&
          typeof detail === 'object' &&
          'code' in detail &&
          detail.code === 'game-started'
        )
          throw new Error('The room changed. Refresh before saving.');
      }
      if (response.status >= 500)
        this.logs.add('error', `Online service returned HTTP ${response.status}.`, 'network');
      else if (response.status === 429)
        this.logs.add('warn', 'Online service rate limit reached.', 'network');
      else if (response.status === 409)
        this.logs.add('warn', 'Concurrent shared update detected.', 'room');
      const errors: Record<number, string> = {
        400: 'Invalid online request.',
        401: 'Room credentials are incorrect or expired.',
        403: 'This action is not permitted by the host.',
        404: 'This room or share has expired or was removed.',
        410: 'This room has ended.',
        409:
          path.endsWith('/join') || path.endsWith('/player')
            ? 'This seat is already occupied.'
            : 'The room changed. Refresh before saving.',
        413: 'Shared data must be smaller than 5 MiB.',
        429: 'Too many attempts. Try again in a minute.',
        507: 'Online storage is full. Try again later.',
      };
      throw new Error(errors[response.status] ?? 'Could not connect to the online service.');
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  link(key: 'share' | 'room', id: string, pin?: string): string {
    const tree = this.router.createUrlTree(['/online'], {
      queryParams: { [key]: id, ...(key === 'room' && pin ? { pin } : {}) },
    });
    return new URL(
      this.location.prepareExternalUrl(this.router.serializeUrl(tree)),
      document.baseURI,
    ).href;
  }
}
