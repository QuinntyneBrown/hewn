import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PROJECT_EVENTS, ProjectSummary } from '@hewn/api';
import { IconComponent, StatusComponent } from '@hewn/components';
import { map } from 'rxjs';
import { ProjectsPrefetch } from '../../core/projects-prefetch';
import { SessionStore } from '../../core/session-store';
import {
  byActivity,
  countByStatus,
  lastActivityText,
  parseStatusFilter,
  STATUS_FILTERS,
  upsertRow,
  withStatus,
} from './projects-list';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Every project with its stage, status, percent complete, spend and last activity, newest first (L2-002). The
 * status filter lives in `?status=` so a reload keeps it, and rows change in place from the live stream.
 */
@Component({
  selector: 'hw-projects-page',
  imports: [IconComponent, RouterLink, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects.page.html',
})
export class ProjectsPage {
  private readonly projects = inject(ProjectsPrefetch);
  private readonly live = inject(PROJECT_EVENTS);
  protected readonly session = inject(SessionStore);

  protected readonly filters = STATUS_FILTERS;
  protected readonly filter = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => parseStatusFilter(q.get('status')))),
    { initialValue: null },
  );

  private readonly all = signal<ProjectSummary[] | null>(null);
  protected readonly failure = signal<string | null>(null);
  private readonly now = signal(new Date());

  protected readonly loaded = computed(() => this.all() !== null);
  protected readonly total = computed(() => this.all()?.length ?? 0);
  protected readonly counts = computed(() => countByStatus(this.all() ?? []));
  protected readonly rows = computed(() =>
    withStatus(this.all() ?? [], this.filter()).map((p) => ({
      ...p,
      spend: usd.format(p.spendUsd),
      activity: lastActivityText(p.lastActivityAt, this.now()),
    })),
  );

  constructor() {
    const tick = setInterval(() => this.now.set(new Date()), 1_000);
    const updates = this.live.followProjects().subscribe({
      next: (update) => {
        if (update.kind === 'resync') this.load();
        else if (this.all()) this.all.update((rows) => upsertRow(rows ?? [], update.row));
      },
      // The list still works without live rows; a reload brings them back.
      error: () => undefined,
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      updates.unsubscribe();
    });
    this.load();
  }

  protected load(): void {
    this.failure.set(null);
    this.projects.list().subscribe({
      next: (rows) => this.all.set(byActivity(rows)),
      error: (error: unknown) => {
        const status =
          error instanceof HttpErrorResponse && error.status
            ? `${error.status} ${error.statusText}`
            : 'no response';
        this.failure.set(
          `The Hewn API returned ${status}. Your directions are still running on their workers.`,
        );
      },
    });
  }
}
