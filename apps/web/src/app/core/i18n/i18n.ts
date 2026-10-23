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
    this.set(
      preferred === 'zh-TW' || preferred === 'zh-CN' || preferred === 'ja' || preferred === 'en'
        ? preferred
        : 'en',
    );
  }
  set(language: Language): void {
    this.locale.set(language);
    this.document.documentElement.lang = language;
    this.document.title =
      language === 'ja'
        ? 'Riichi / table — 麻雀点数計算'
        : language === 'zh-CN'
          ? 'Riichi / table — 日麻计分'
          : language === 'zh-TW'
            ? 'Riichi / table — 日麻計分'
            : 'Riichi / table — Mahjong scorer';
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
    if (this.locale() === 'ja') {
      return kind.type === 'suited'
        ? `${tile.isRed ? '赤' : ''}${kind.rank}${{ man: '萬', pin: '筒', sou: '索' }[kind.suit]}`
        : kind.type === 'wind'
          ? this.t(kind.wind)
          : { white: '白', green: '發', red: '中' }[kind.dragon];
    }
    return kind.type === 'suited'
      ? `${tile.isRed ? '赤' : ''}${kind.rank}${{ man: this.locale() === 'zh-CN' ? '万' : '萬', pin: '筒', sou: '索' }[kind.suit]}`
      : kind.type === 'wind'
        ? `${this.t(kind.wind)}${this.locale() === 'zh-CN' ? '风' : '風'}`
        : { white: '白', green: this.locale() === 'zh-CN' ? '发' : '發', red: '中' }[kind.dragon];
  }
}
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18n);
  transform(source: string | null | undefined): string {
    return this.i18n.t(source);
  }
}
