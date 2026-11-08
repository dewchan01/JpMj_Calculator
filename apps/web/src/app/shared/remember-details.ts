import { Directive, input, inject, ElementRef } from '@angular/core';
import { DetailTabMemory } from '../core/detail-tab-memory';

@Directive({
  selector: 'details[appRememberDetails]',
  host: { '[open]': 'isOpen()', '(toggle)': 'remember()' },
})
export class RememberDetails {
  readonly appRememberDetails = input.required<string>();
  private readonly memory = inject(DetailTabMemory);
  private readonly element = inject<ElementRef<HTMLDetailsElement>>(ElementRef);
  readonly isOpen = this.memory.remember(
    () => `expanded:${this.appRememberDetails()}`,
    () => false,
  );
  remember(): void {
    this.isOpen.set(this.element.nativeElement.open);
  }
}
