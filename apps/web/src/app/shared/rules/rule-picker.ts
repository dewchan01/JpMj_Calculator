import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ruleName, type RuleProfile } from '../../../../../../packages/mahjong-rules/index';
import { TranslatePipe } from '../../core/i18n/i18n';
@Component({
  selector: 'app-rule-picker',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './rule-picker.html',
  styleUrl: './rule-picker.css',
})
export class RulePicker {
  readonly profile = input.required<RuleProfile>();
  readonly locked = input(false);
  readonly ruleName = ruleName;
}
