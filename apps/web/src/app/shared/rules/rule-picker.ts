import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  presetRules,
  ruleName,
  ruleSettings,
  type RulePreset,
  type RuleProfile,
  type RuleSettings,
} from '../../../../../../packages/mahjong-rules/index';
import { TranslatePipe } from '../../core/i18n/i18n';

@Component({
  selector: 'app-rule-picker',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './rule-picker.html',
})
export class RulePicker {
  readonly profile = model.required<RuleProfile>();
  readonly locked = input(false);
  readonly toggles: {
    key: 'doubleYakuman' | 'stackYakuman' | 'redFives' | 'kokushiAnkanRon' | 'kitaRinshan';
    label: string;
  }[] = [
    { key: 'doubleYakuman', label: 'Double Yakuman for special forms' },
    { key: 'stackYakuman', label: 'Combine multiple Yakuman' },
    { key: 'redFives', label: 'Red fives enabled' },
    { key: 'kokushiAnkanRon', label: 'Allow Kokushi Ron on Ankan' },
    { key: 'kitaRinshan', label: 'Kita replacement awards Rinshan' },
  ];
  get settings(): Readonly<RuleSettings> {
    return ruleSettings(this.profile());
  }
  get editable(): boolean {
    return !this.locked() && this.profile().preset === 'custom';
  }
  select(preset: RulePreset): void {
    if (!this.locked()) this.profile.set(presetRules(preset, this.profile().playerCount));
  }
  setting<K extends keyof RuleSettings>(key: K, value: RuleSettings[K]): void {
    if (this.editable)
      this.profile.set({ ...this.profile(), settings: { ...this.settings, [key]: value } });
  }
  root<K extends 'startingPoints' | 'tsumo' | 'kiriage' | 'openTanyao'>(
    key: K,
    value: RuleProfile[K],
  ): void {
    if (this.editable) this.profile.set({ ...this.profile(), [key]: value });
  }
  description(): string {
    if (this.profile().preset === 'm-league')
      return 'M.League: four players, head-bump Ron, Kiriage Mangan, single special-wait Yakuman and no counted Yakuman. Final league points and penalties are not included.';
    return ruleName(this.profile()) === 'Tenhou'
      ? 'Tenhou ranked, open Tanyao and red fives. Special waits stay single Yakuman; triple Ron is an abortive draw.'
      : this.profile().preset === 'custom'
        ? 'Custom house rules. Review the settings before you start; they remain fixed for the match.'
        : 'Mahjong Soul ranked-inspired. Double Yakuman variants and triple Ron are enabled; Sanma uses Tsumo-loss.';
  }
}
