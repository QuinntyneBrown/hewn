import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconComponent } from '../icon/icon';
import { IconName, ICONS } from '../icon/icons';

export type StatusName =
  | 'Pending'
  | 'Queued'
  | 'Running'
  | 'Paused'
  | 'Succeeded'
  | 'Complete'
  | 'Failed'
  | 'Skipped'
  | 'Cancelled'
  | 'Idle'
  | 'Blocked';

interface StatusLook {
  icon: IconName;
  tone: 'muted' | 'run' | 'ok' | 'warn' | 'fail' | 'idle';
  spin?: boolean;
}

export const STATUS_LOOKS: Record<StatusName, StatusLook> = {
  Pending: { icon: 'pending', tone: 'muted' },
  Queued: { icon: 'pending', tone: 'muted' },
  Running: { icon: 'spinner', tone: 'run', spin: true },
  Paused: { icon: 'pauseCircle', tone: 'warn' },
  Succeeded: { icon: 'checkCircle', tone: 'ok' },
  Complete: { icon: 'checkCircle', tone: 'ok' },
  Failed: { icon: 'xCircle', tone: 'fail' },
  Skipped: { icon: 'skipCircle', tone: 'muted' },
  Cancelled: { icon: 'banCircle', tone: 'muted' },
  Idle: { icon: 'idleCircle', tone: 'idle' },
  Blocked: { icon: 'xCircle', tone: 'fail' },
};

/** The small status icon in stage lists: `<svg hw-status-icon status="Succeeded">` → `icon s-icon--ok icon--sm`. */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[hw-status-icon]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    '[attr.class]': 'classes()',
    '[innerHTML]': 'body()',
  },
  template: '',
})
export class StatusIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly status = input.required<StatusName>();
  readonly size = input<'sm' | 'md'>('sm');

  private readonly look = computed(() => STATUS_LOOKS[this.status()]);
  protected readonly body = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.look().icon]),
  );
  protected readonly classes = computed(() => {
    const look = this.look();
    return [
      'icon',
      `s-icon--${look.tone}`,
      look.spin ? 'icon--spin' : '',
      this.size() === 'sm' ? 'icon--sm' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
}

/** A status pill with icon and text label; the host is the `.status status--{tone}` element. */
@Component({
  selector: 'hw-status',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.class]': "'status status--' + look().tone" },
  template: `<svg hw-icon [name]="look().icon" [class.icon--spin]="!!look().spin"></svg
    >{{ label() || status() }}`,
})
export class StatusComponent {
  readonly status = input.required<StatusName>();
  /** Overrides the visible label (defaults to the status name). */
  readonly label = input<string>('');

  protected readonly look = computed(() => STATUS_LOOKS[this.status()]);
}
