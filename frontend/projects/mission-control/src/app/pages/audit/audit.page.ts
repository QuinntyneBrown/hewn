import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AUDIT_API, AuditAction, AuditEntry, AuditProject } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { map } from 'rxjs';
import { SessionStore } from '../../core/session-store';
import {
  AUDIT_ACTIONS,
  actionLabel,
  actionWarns,
  auditTime,
  loadFailure,
  noResultsText,
  parseAction,
} from './audit-text';

interface Filters {
  project: string | null;
  action: AuditAction | null;
}

/**
 * The audit log (L2-044 AC2): for Owners, entries newest first, filtered by project and action. The filters live in
 * `?project=` and `?action=`, so a reload keeps them. Viewers see the forbidden state; the API answers them 403.
 */
@Component({
  selector: 'hw-audit-page',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit.page.html',
})
export class AuditPage {
  private readonly api = inject(AUDIT_API);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  protected readonly actions = AUDIT_ACTIONS;
  protected readonly skeletonRows = Array.from({ length: 8 }, (_, i) => i);

  protected readonly filters = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((q): Filters => ({ project: q.get('project'), action: parseAction(q.get('action')) })),
    ),
    { initialValue: { project: null, action: null } as Filters },
  );

  protected readonly entries = signal<AuditEntry[] | null>(null);
  protected readonly projects = signal<AuditProject[]>([]);
  protected readonly next = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly forbidden = signal(false);
  protected readonly loadingOlder = signal(false);
  /** The filters the shown entries were read with, so a slow answer for old filters is dropped. */
  private loaded = '';

  protected readonly filtered = computed(() => !!this.filters().project || !!this.filters().action);
  protected readonly projectName = computed(
    () => this.projects().find((p) => p.id === this.filters().project)?.name ?? null,
  );
  protected readonly noResults = computed(() =>
    noResultsText(this.projectName(), this.filters().action),
  );
  protected readonly rows = computed(() =>
    (this.entries() ?? []).map((e) => ({
      ...e,
      when: auditTime(e.at),
      label: actionLabel(e.action),
      warns: actionWarns(e.action),
      shownTarget: e.target ?? '—',
      ip: e.ipAddress ?? '—',
    })),
  );

  constructor() {
    // Each change of filter reads the log again; the filters signal above has the new values by then.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  protected load(): void {
    if (!this.session.isOwner()) {
      this.forbidden.set(true);
      return;
    }
    const filters = this.filters();
    const key = JSON.stringify(filters);
    this.loaded = key;
    this.entries.set(null);
    this.failure.set(null);
    this.api.list(filters).subscribe({
      next: (log) => {
        if (this.loaded !== key) return;
        this.entries.set(log.entries);
        this.projects.set(log.projects);
        this.next.set(log.next);
      },
      error: (error: unknown) => this.fail(error, key),
    });
  }

  protected showOlder(): void {
    const before = this.next();
    if (!before || this.loadingOlder()) return;
    const key = this.loaded;
    this.loadingOlder.set(true);
    this.api.list({ ...this.filters(), before }).subscribe({
      next: (log) => {
        this.loadingOlder.set(false);
        if (this.loaded !== key) return;
        this.entries.update((rows) => [...(rows ?? []), ...log.entries]);
        this.next.set(log.next);
      },
      error: (error: unknown) => {
        this.loadingOlder.set(false);
        this.fail(error, key);
      },
    });
  }

  protected filterBy(name: 'project' | 'action', event: Event): void {
    const value = (event.target as HTMLSelectElement).value || null;
    void this.router.navigate([], {
      queryParams: { [name]: value },
      queryParamsHandling: 'merge',
    });
  }

  private fail(error: unknown, key: string): void {
    if (this.loaded !== key) return;
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 403) this.forbidden.set(true);
    else this.failure.set(loadFailure(status));
  }
}
