import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CatchUp, ConnectionStatus, Leasing, PROJECT_EVENTS, WORKERS_API } from '@hewn/api';
import { IconComponent, IconName } from '@hewn/components';
import { SessionStore } from '../core/session-store';
import { Toasts } from '../core/toasts';
import { WorkersStore } from '../core/workers-store';
import { stoppedBanner } from '../pages/workers/workers-text';
import { ConnectionBanner, connectionBanner, connectionState } from './connection-banner';
import { filter } from 'rxjs';
import { ToastRegionComponent } from './toast-region';
import { WordmarkComponent } from './wordmark';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
  /** Hidden from Viewers, as the mocks show (the audit log is the Owners'). */
  ownerOnly?: boolean;
}

/** Sidebar, top bar and main region shared by every signed-in page. */
@Component({
  selector: 'hw-shell',
  imports: [
    NgTemplateOutlet,
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
  private readonly menu = viewChild.required<TemplateRef<unknown>>('menu');
  private menuRef: DialogRef | null = null;
  protected readonly starting = signal(false);
  protected readonly signingOut = signal(false);
  private readonly events = inject(PROJECT_EVENTS);
  private readonly status = toSignal(this.events.status(), {
    initialValue: { state: 'connecting' } as ConnectionStatus,
  });
  /** What the last reconnect caught up, shown for a few seconds once live (L2-032 AC3). */
  private readonly caughtUp = signal<CatchUp | null>(null);
  private readonly now = signal(Date.now());
  private readonly openedAt = Date.now();
  protected readonly stripIcon: Record<ConnectionBanner['tone'], IconName> = {
    info: 'spinner',
    warn: 'refresh',
    danger: 'wifiOff',
    ok: 'checkCircle',
  };

  protected readonly connection = computed(() => connectionState(this.status()));
  protected readonly connectionBanner = computed(() => {
    const status = this.status();
    // A quick first connection shows no banner at all.
    if (status.state === 'connecting' && this.now() - this.openedAt < 1_000) return null;
    return connectionBanner(status, this.now(), this.events.lastSequence(), this.caughtUp());
  });
  protected readonly workerCount = computed(() => {
    const all = this.workers.view()?.workers;
    if (!all?.length) return null;
    return `${all.filter((w) => w.status !== 'Offline').length} of ${all.length} workers`;
  });

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
    let hide: ReturnType<typeof setTimeout> | undefined;
    this.events
      .caughtUp()
      .pipe(takeUntilDestroyed())
      .subscribe((caught) => {
        this.caughtUp.set(caught);
        clearTimeout(hide);
        hide = setTimeout(() => this.caughtUp.set(null), 5_000);
      });
    this.events
      .status()
      .pipe(takeUntilDestroyed())
      .subscribe((s) => {
        this.now.set(Date.now());
        if (s.state !== 'live') this.caughtUp.set(null);
      });

    // The leasing switch is global: refresh it on every navigation and every few seconds.
    void this.workers.refresh();
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        void this.workers.refresh();
        this.closeMenu();
      });
    // The sidebar replaces the drawer from 992 px (L2-046 AC3).
    const wide = matchMedia('(min-width: 62rem)');
    const onWide = (e: MediaQueryListEvent) => e.matches && this.closeMenu();
    wide.addEventListener('change', onWide);
    inject(DestroyRef).onDestroy(() => wide.removeEventListener('change', onWide));
    const timer = setInterval(() => void this.workers.refresh(), 5_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // A worker registering, leasing or finishing shows at once (L2-026 AC1); the timer covers heartbeats.
    this.events
      .followWorkers()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: () => void this.workers.refresh(), error: () => undefined });
  }

  /** Below 992 px the sidebar opens as a drawer: focus starts on Close, stays inside, and returns to Menu (L2-046 AC1). */
  protected openMenu(): void {
    if (this.menuRef) return;
    this.menuRef = this.dialog.open(this.menu(), {
      ariaLabel: 'Menu',
      ariaModal: true,
      panelClass: 'drawer-pane',
      backdropClass: 'backdrop',
      autoFocus: 'first-tabbable',
    });
    this.menuRef.closed.subscribe(() => (this.menuRef = null));
  }

  protected closeMenu(): void {
    this.menuRef?.close();
  }

  protected retryNow(): void {
    this.events.retryNow();
  }

  protected banner(leasing: Leasing): string {
    return stoppedBanner(leasing);
  }

  /** L2-029 AC4: confirm, then every worker halts its active run within 10 seconds. */
  /** Ends the session and reloads at sign-in, so nothing from it stays in memory (L2-038 AC3). */
  protected signOut(): void {
    this.signingOut.set(true);
    this.session.signOut().then(
      () => location.assign('/sign-in?reason=signed-out'),
      () => {
        this.signingOut.set(false);
        this.toasts.show({
          tone: 'warn',
          title: 'You weren’t signed out',
          text: 'Nothing changed; try again.',
        });
      },
    );
  }

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

  private readonly allNav: NavItem[] = [
    { label: 'Dashboard', link: '/dashboard', icon: 'dashboard' },
    { label: 'Projects', link: '/projects', icon: 'projects' },
    { label: 'Workers', link: '/workers', icon: 'workers' },
    { label: 'Audit', link: '/audit', icon: 'audit', ownerOnly: true },
    { label: 'Settings', link: '/settings', icon: 'settings' },
  ];
  protected readonly nav = computed(() =>
    this.allNav.filter((item) => !item.ownerOnly || this.session.isOwner()),
  );

  protected readonly initials = computed(() =>
    (this.session.me()?.login ?? '?').slice(0, 2).toUpperCase(),
  );
}
