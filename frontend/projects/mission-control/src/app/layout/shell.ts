import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Leasing, WORKERS_API } from '@hewn/api';
import { IconComponent, IconName } from '@hewn/components';
import { SessionStore } from '../core/session-store';
import { Toasts } from '../core/toasts';
import { WorkersStore } from '../core/workers-store';
import { stoppedBanner } from '../pages/workers/workers-text';
import { filter } from 'rxjs';
import { ToastRegionComponent } from './toast-region';
import { WordmarkComponent } from './wordmark';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
}

/** Sidebar, top bar and main region shared by every signed-in page. */
@Component({
  selector: 'hw-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    WordmarkComponent,
    ToastRegionComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class ShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly workers = inject(WorkersStore);
  private readonly workersApi = inject(WORKERS_API);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(Toasts);
  protected readonly starting = signal(false);

  constructor() {
    // The leasing switch is global: refresh it on every navigation and every few seconds.
    void this.workers.refresh();
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.workers.refresh());
    const timer = setInterval(() => void this.workers.refresh(), 5_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected banner(leasing: Leasing): string {
    return stoppedBanner(leasing);
  }

  /** L2-029 AC4: confirm, then every worker halts its active run within 10 seconds. */
  protected openStopWorkers(): void {
    // Loaded on demand, so the dialog stays out of the initial bundle.
    void Promise.all([this.workers.refresh(), import('../pages/workers/stop-workers.dialog')]).then(
      ([, m]) =>
        this.dialog.open(m.StopWorkersDialog, {
          role: 'alertdialog',
          ariaLabelledBy: 'stop-workers-title',
          ariaDescribedBy: 'stop-workers-desc',
          backdropClass: 'backdrop',
          autoFocus: 'first-tabbable',
        }),
    );
  }

  /** Leasing comes back on; each halted run resumes from its last checkpoint. */
  protected startWorkers(): void {
    if (this.starting()) return;
    this.starting.set(true);
    this.workersApi.start().subscribe({
      next: () => void this.workers.refresh().finally(() => this.starting.set(false)),
      error: () => {
        this.starting.set(false);
        this.toasts.show({
          tone: 'warn',
          title: 'Workers weren’t started',
          text: 'Nothing changed; try again.',
        });
      },
    });
  }

  protected readonly nav: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'dashboard' },
    { label: 'Projects', link: '/projects', icon: 'projects' },
    { label: 'Workers', link: '/workers', icon: 'workers' },
    { label: 'Audit', link: '/audit', icon: 'audit' },
    { label: 'Settings', link: '/settings', icon: 'settings' },
  ];

  protected readonly initials = computed(() =>
    (this.session.me()?.login ?? '?').slice(0, 2).toUpperCase(),
  );
}
