import { ResponsiveSheet } from '../responsive-sheet';
import { DialogBackdrop } from '../dialog-backdrop';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  presetRules,
  ruleName,
  type RuleProfile,
} from '../../../../../../packages/mahjong-rules/index';
import { RuleLibrary } from '../../features/settings/rule-library';
import { ErrorNotice } from '../error-notice/error-notice';
import { TranslatePipe } from '../../core/i18n/i18n';
@Component({
  selector: 'app-rule-picker',
  imports: [ResponsiveSheet, DialogBackdrop, TranslatePipe, RouterLink, ErrorNotice],
  templateUrl: './rule-picker.html',
  styleUrl: './rule-picker.css',
})
export class RulePicker {
  readonly profile = input.required<RuleProfile>();
  readonly locked = input(false);
  readonly ruleName = ruleName;
  readonly library = inject(RuleLibrary);
  readonly changed = output<RuleProfile>();
  readonly error = signal('');
  readonly choices = computed(() =>
    [
      this.profile(),
      ...(
        [
          'mahjong-soul',
          'tenhou',
          ...(this.profile().playerCount === 4 ? (['m-league'] as const) : []),
        ] as const
      ).map((preset) => presetRules(preset, this.profile().playerCount)),
      ...this.library.profiles(this.profile().playerCount),
    ].filter(
      (profile, index, profiles) =>
        profiles.findIndex((other) => other.id === profile.id) === index,
    ),
  );
  choose(profile: RuleProfile, dialog: HTMLDialogElement): void {
    if (this.locked()) return;
    try {
      this.library.use(profile);
      this.changed.emit(profile);
      dialog.close();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not save rules.');
    }
  }
}
