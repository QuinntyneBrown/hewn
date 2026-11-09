import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent, IconName } from '@hewn/components';
import { Toasts, ToastTone } from '../core/toasts';

const ICONS: Record<ToastTone, IconName> = { info: 'info', ok: 'checkCircle', warn: 'warning' };

/** The polite region live toasts appear in (info, success and warning share it). */
@Component({
  selector: 'hw-toast-region',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'toast-region', role: 'status', 'aria-live': 'polite' },
  template: `@for (toast of toasts.items(); track toast.id) {
    <div
      class="toast"
      [class]="'toast toast--' + toast.tone"
      (mouseenter)="toasts.pause(toast.id)"
      (mouseleave)="toasts.resume(toast.id)"
      (focusin)="toasts.pause(toast.id)"
      (focusout)="toasts.resume(toast.id)"
    >
      <svg hw-icon [name]="icons[toast.tone]"></svg>
      <div class="toast__body">
        <div class="toast__title">{{ toast.title }}</div>
        <div class="toast__text">{{ toast.text }}</div>
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
}
