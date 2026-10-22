import { DOCUMENT } from '@angular/common';
import { inject, Injectable, Pipe, type PipeTransform, signal } from '@angular/core';
import type { Tile } from '../../../../../../packages/mahjong-core/index';
import { tileName } from '../../../../../../packages/mahjong-core/index';
import { translate, type Language } from './messages';

@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly document = inject(DOCUMENT);
  readonly locale = signal<Language>('en');
  constructor() {
    let preferred: string | null = null;
    try {
      preferred = this.document.defaultView?.localStorage.getItem('riichi-language') ?? null;
    } catch {
      /* Language switching also works when browser storage is disabled. */
    }
    const browser = this.document.defaultView?.navigator.language ?? 'en';
    this.set(
      preferred === 'zh-TW' || preferred === 'en'
        ? preferred
        : /^zh\b/i.test(browser)
          ? 'zh-TW'
          : 'en',
    );
  }
  set(language: Language): void {
    this.locale.set(language);
    this.document.documentElement.lang = language;
    this.document.title =
      language === 'zh-TW' ? 'Riichi / table — 日麻計分' : 'Riichi / table — Mahjong scorer';
    try {
      this.document.defaultView?.localStorage.setItem('riichi-language', language);
    } catch {
      /* Keep the in-memory selection. */
    }
  }
  t(source: string | null | undefined): string {
    return translate(source, this.locale());
  }
  tile(tile: Tile): string {
    if (this.locale() === 'en') return tileName(tile);
    const kind = tile.kind;
    return kind.type === 'suited'
      ? `${tile.isRed ? '赤' : ''}${kind.rank}${{ man: '萬', pin: '筒', sou: '索' }[kind.suit]}`
      : kind.type === 'wind'
        ? `${this.t(kind.wind)}風`
        : { white: '白', green: '發', red: '中' }[kind.dragon];
  }
}
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(source: string | null | undefined): string {
    return this.i18n.t(source);
  }
}
