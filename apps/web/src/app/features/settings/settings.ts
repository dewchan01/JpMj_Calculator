import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RuleLibrary } from './rule-library';
import { settingGroups } from '../../shared/rules/settings-fields';
import { ErrorNotice } from '../../shared/error-notice/error-notice';
import { TranslatePipe } from '../../core/i18n/i18n';
import {
  presetRules,
  ruleName,
  ruleSettings,
  tableRules,
  validateProfile,
  type RuleProfile,
  type RulePreset,
  type TableRules,
  type RuleSettings,
} from '../../../../../../packages/mahjong-rules/index';

@Component({
  imports: [ReactiveFormsModule, TranslatePipe, ErrorNotice],
  host: {
    '(document:click)': "help.set('')",
    '(document:keydown.escape)': "help.set('')",
    '(window:blur)': "help.set('')",
    '(document:visibilitychange)': "help.set('')",
  },
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  readonly library = inject(RuleLibrary);
  readonly count = signal<3 | 4>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('players') === '3'
      ? 3
      : inject(ActivatedRoute).snapshot.queryParamMap.get('players') === '4'
        ? 4
        : this.library.preferredCount,
  );
  readonly base = signal(this.library.draft(this.count()));
  readonly selected = signal(this.base().id);
  readonly errors = signal<string[]>([]);
  readonly notice = signal('');
  readonly help = signal('');
  toggleHelp(key: string, event: Event): void {
    event.stopPropagation();
    this.help.update((current) => (current === key ? '' : key));
  }

  readonly groups = settingGroups;
  readonly ruleName = ruleName;
  readonly form = new FormGroup<Record<string, FormControl<string | number | boolean>>>(
    Object.fromEntries([
      ['name', new FormControl<string | number | boolean>('', { nonNullable: true })],
      ...settingGroups
        .flatMap((group) => group.fields)
        .map((field) => [
          field.key,
          new FormControl<string | number | boolean>('', { nonNullable: true }),
        ]),
    ]),
  );
  constructor() {
    this.load(this.base());
  }
  setCount(count: 3 | 4): void {
    this.count.set(count);
    this.load(this.library.draft(count));
  }
  choose(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const saved = this.library.profiles(this.count()).find((profile) => profile.id === id);
    this.load(saved ?? presetRules(id as RulePreset, this.count()));
  }
  private load(profile: RuleProfile): void {
    this.base.set(profile);
    this.selected.set(
      profile.preset === 'custom'
        ? this.library.profiles(this.count()).some((saved) => saved.id === profile.id)
          ? profile.id
          : 'custom'
        : (profile.preset ?? 'mahjong-soul'),
    );
    const table = tableRules(profile);
    const { uma, ...tableValues } = table;
    this.form.patchValue({
      ...tableValues,
      ...ruleSettings(profile),
      name: profile.name ?? '',
      startingPoints: profile.startingPoints,
      kiriage: profile.kiriage,
      openTanyao: profile.openTanyao,
      ...Object.fromEntries([1, 2, 3, 4].map((rank) => ['uma' + rank, uma[rank - 1] ?? 0])),
    });
    this.form.markAsPristine();
    this.errors.set([]);
    this.notice.set('');
  }
  profile(custom = false): RuleProfile {
    const values = this.form.getRawValue();
    const table = Object.fromEntries(
      Object.keys(tableRules(this.base()))
        .filter((key) => key !== 'uma')
        .map((key) => [key, values[key]]),
    ) as unknown as TableRules;
    table.uma = Array.from({ length: this.count() }, (_, index) =>
      Number(values['uma' + (index + 1)]),
    );
    const settings = Object.fromEntries(
      Object.keys(ruleSettings(this.base())).map((key) => [key, values[key]]),
    ) as unknown as RuleSettings;
    return {
      ...this.base(),
      ...(custom ? { preset: 'custom' as const, name: String(values['name']).trim() } : {}),
      playerCount: this.count(),
      startingPoints: Number(values['startingPoints']),
      kiriage: values['kiriage'] === true,
      openTanyao: values['openTanyao'] === true,
      table,
      settings,
      tsumo: table.tsumoMode === 'no-loss' ? 'north-bisection' : 'loss',
    };
  }
  save(apply = false): void {
    this.errors.set([]);
    this.notice.set('');
    const profile = this.profile(true);
    const errors = validateProfile(profile);
    if (errors.length) {
      this.errors.set(errors);
      return;
    }
    try {
      const saved = this.library.save(profile);
      if (apply) this.library.use(saved);
      this.load(saved);
      this.notice.set(
        apply
          ? 'Saved and applied to new tables and Quick score.'
          : 'Custom rules saved. Choose Use these rules to apply them.',
      );
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Rules could not be saved.']);
    }
  }
  apply(): void {
    this.notice.set('');
    this.errors.set([]);
    if (this.form.dirty) {
      this.save(true);
      return;
    }
    try {
      this.library.use(this.base());
      this.notice.set(
        'Applied to new tables and Quick score. Existing tables keep their saved rules.',
      );
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Rules could not be saved.']);
    }
  }
  remove(): void {
    try {
      this.library.remove(this.base());
      this.load(this.library.active(this.count()));
      this.notice.set('Custom rules deleted.');
    } catch (error) {
      this.errors.set([error instanceof Error ? error.message : 'Rules could not be saved.']);
    }
  }
}
