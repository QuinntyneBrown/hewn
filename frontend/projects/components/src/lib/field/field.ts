import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon';

/**
 * A labelled form field (`.field`). Project the control; give it `id` = `controlId` and
 * `aria-describedby` = `describedBy(...)` so the hint or error is announced with it.
 */
@Component({
  selector: 'hw-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The host is the .field element itself, so design-system sibling rules (e.g. `.callout + *`) apply.
  host: { class: 'field' },
  template: `<label class="field__label" [attr.for]="controlId()"
      >{{ label() }}
      @if (optional()) {
        <span class="optional">(optional)</span>
      }
    </label>
    <div class="field__control"><ng-content /></div>
    @if (error()) {
      <span class="field__error" [id]="controlId() + '-err'"
        ><svg hw-icon name="errorCircle" class="icon--sm"></svg>{{ error() }}</span
      >
    } @else if (hint()) {
      <span class="field__hint" [id]="controlId() + '-hint'">{{ hint() }}</span>
    }`,
})
export class FieldComponent {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly error = input<string | null | undefined>(null);
  readonly optional = input(false);
}

/** The id the control's aria-describedby should point at. */
export function describedBy(controlId: string, error: string | null | undefined): string {
  return error ? `${controlId}-err` : `${controlId}-hint`;
}
