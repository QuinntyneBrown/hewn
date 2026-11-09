import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { IconComponent } from '../icon/icon';

export interface ErrorSummaryItem {
  /** Id of the control the line links to. */
  controlId: string;
  text: string;
}

/**
 * The linked error summary above a form. The host is the `.callout--danger.form-summary` element itself
 * (hidden when there is nothing to fix), so design-system sibling rules apply. Takes focus when shown.
 */
@Component({
  selector: 'hw-error-summary',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "items().length ? 'callout callout--danger form-summary' : ''",
    '[attr.role]': "items().length ? 'alert' : null",
    '[attr.tabindex]': "items().length ? '-1' : null",
    '[hidden]': '!items().length',
  },
  template: `@if (items().length) {
    <svg hw-icon name="warning" class="icon--lg"></svg>
    <div>
      <p class="callout__title">{{ title() }}</p>
      <ul>
        @for (item of items(); track item.controlId) {
          <li>
            <a [href]="'#' + item.controlId" (click)="focusControl($event, item.controlId)">{{
              item.text
            }}</a>
          </li>
        }
      </ul>
    </div>
  }`,
})
export class ErrorSummaryComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly items = input<ErrorSummaryItem[]>([]);
  /** What the form is for, e.g. "before Hewn can start". */
  readonly purpose = input('before you continue');

  protected readonly title = computed(() => {
    const n = this.items().length;
    return `${n} ${n === 1 ? 'thing' : 'things'} to fix ${this.purpose()}`;
  });

  constructor() {
    effect(() => {
      if (this.items().length) {
        queueMicrotask(() => this.host.nativeElement.focus());
      }
    });
  }

  protected focusControl(event: Event, controlId: string): void {
    const control = document.getElementById(controlId);
    if (control) {
      event.preventDefault();
      control.focus();
    }
  }
}
