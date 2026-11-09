import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '@hewn/components';
import { Toasts, ToastTone } from '../core/toasts';

const ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  ok: 'checkCircle',
  warn: 'warning',
  danger: 'xCircle',
};

/** The polite region live toasts appear in; a danger toast is an alert and stays until dismissed. */
@Component({
  selector: 'hw-toast-region',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'toast-region', role: 'status', 'aria-live': 'polite' },
  template: `@for (toast of toasts.items(); track toast.id) {
    <div
      class="toast"
      [class]="'toast toast--' + toast.tone"
      [attr.role]="toast.tone === 'danger' ? 'alert' : null"
      (mouseenter)="toasts.pause(toast.id)"
      (mouseleave)="toasts.resume(toast.id)"
      (focusin)="toasts.pause(toast.id)"
      (focusout)="toasts.resume(toast.id)"
    >
      <svg hw-icon [name]="icons[toast.tone]"></svg>
      <div class="toast__body">
        <div class="toast__title">{{ toast.title }}</div>
        <div class="toast__text">{{ toast.text }}</div>
        @if (toast.actions?.length) {
          <div class="toast__actions">
            @for (action of toast.actions; track action.label) {
              @if (action.link) {
                <a
                  class="toast__action"
                  [routerLink]="action.link"
                  [queryParams]="action.queryParams"
                  (click)="toasts.dismiss(toast.id)"
                  >{{ action.label }}</a
                >
              } @else {
                <button class="toast__action" type="button" (click)="act(toast.id, action.run)">
                  {{ action.label }}
                </button>
              }
            }
          </div>
        }
      </div>
      <button
        class="toast__close"
        type="button"
        [attr.aria-label]="'Dismiss: ' + toast.title"
        (click)="toasts.dismiss(toast.id)"
      >
        <svg hw-icon name="close" class="icon--sm"></svg>
      </button>
    </div>
  }`,
})
export class ToastRegionComponent {
  protected readonly toasts = inject(Toasts);
  protected readonly icons = ICONS;

  protected act(id: number, run?: () => void): void {
    this.toasts.dismiss(id);
    run?.();
  }
}
