import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-signed-value',
  imports: [DecimalPipe],
  templateUrl: './signed-value.html',
  styleUrl: './signed-value.css',
})
export class SignedValue {
  readonly value = input.required<number>();
  readonly digits = input('1.0-3');
}
