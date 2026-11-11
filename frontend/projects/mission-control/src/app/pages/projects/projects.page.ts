import { Dialog } from '@angular/cdk/dialog';
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
import { PROJECT_EVENTS, PROJECTS_API, ProjectSummary } from '@hewn/api';
import { IconComponent, StatusComponent } from '@hewn/components';
import { map } from 'rxjs';
import { ProjectsPrefetch } from '../../core/projects-prefetch';
import { SessionStore } from '../../core/session-store';
import { Toasts } from '../../core/toasts';
import { DeleteProjectData, DeleteProjectDialog } from './delete-project.dialog';
import {
  archiveRefusal,
  byActivity,
  canArchive,
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
  private readonly api = inject(PROJECTS_API);
  private readonly toasts = inject(Toasts);
  private readonly dialog = inject(Dialog);
  protected readonly session = inject(SessionStore);

  protected readonly filters = STATUS_FILTERS;
  protected readonly filter = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => parseStatusFilter(q.get('status')))),
    { initialValue: null },
  );

  private readonly all = signal<ProjectSummary[] | null>(null);
  /** Projects with an archive or restore request in flight; their action is disabled until it answers. */
  protected readonly pending = signal<ReadonlySet<string>>(new Set());
  protected readonly failure = signal<string | null>(null);
  private readonly now = signal(new Date());

  protected readonly loaded = computed(() => this.all() !== null);
  /** Projects in the default list; archived ones are counted under Archived only. */
  protected readonly total = computed(() => (this.all() ?? []).filter((p) => !p.archived).length);
  protected readonly anyArchived = computed(() => (this.all() ?? []).some((p) => p.archived));
  protected readonly counts = computed(() => countByStatus(this.all() ?? []));
  protected readonly rows = computed(() =>
    withStatus(this.all() ?? [], this.filter()).map((p) => ({
      ...p,
      spend: usd.format(p.spendUsd),
      activity: lastActivityText(p.lastActivityAt, this.now()),
      canArchive: canArchive(p),
    })),
  );

  constructor() {
    const tick = setInterval(() => this.now.set(new Date()), 1_000);
    const updates = this.live.followProjects().subscribe({
      next: (update) => {
        if (update.kind === 'resync') this.load();
        else if (update.kind === 'deleted') this.remove(update.projectId);
        else if (this.all()) {
          const row = update.row;
          this.all.update((rows) => upsertRow(rows ?? [], row));
        }
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

  /** L2-003 AC1: moves the project under Archived; AC2: the API refuses one with an active direction. */
  protected archive(project: ProjectSummary): void {
    this.act(project, 'archive', () => ({
      tone: 'ok',
      title: `${project.name} archived`,
      text: 'It’s under Archived, where you can restore it.',
      actions: [
        { label: 'Show archived', link: ['/projects'], queryParams: { status: 'archived' } },
      ],
    }));
  }

  /** L2-003 AC3: the dialog deletes Hewn's records once the name is typed; the repository is kept. */
  protected delete(project: ProjectSummary): void {
    const ref = this.dialog.open<boolean, DeleteProjectData>(DeleteProjectDialog, {
      data: { projectId: project.id, projectName: project.name },
      role: 'alertdialog',
      ariaLabelledBy: 'delete-title',
      ariaDescribedBy: 'delete-desc',
      backdropClass: 'backdrop',
    });
    ref.closed.subscribe((deleted) => {
      if (!deleted) return;
      this.remove(project.id);
      this.toasts.show({
        tone: 'ok',
        title: `${project.name} deleted`,
        text: 'Its GitHub repository is kept.',
      });
    });
  }

  private remove(projectId: string): void {
    this.all.update((rows) => rows && rows.filter((r) => r.id !== projectId));
  }

  /** L2-003 AC1: returns the project to the default list. */
  protected restore(project: ProjectSummary): void {
    this.act(project, 'restore', () => ({
      tone: 'ok',
      title: `${project.name} restored`,
      text: 'It’s back in the projects list.',
    }));
  }

  private act(
    project: ProjectSummary,
    action: 'archive' | 'restore',
    done: () => Parameters<Toasts['show']>[0],
  ): void {
    if (this.pending().has(project.id)) return;
    this.pending.update((ids) => new Set(ids).add(project.id));
    const settle = () =>
      this.pending.update((ids) => {
        const next = new Set(ids);
        next.delete(project.id);
        return next;
      });
    this.api[action](project.id).subscribe({
      next: () => {
        settle();
        // The live row follows; this keeps the list right if the hub is down.
        this.all.update((rows) =>
          (rows ?? []).map((r) =>
            r.id === project.id ? { ...r, archived: action === 'archive' } : r,
          ),
        );
        this.toasts.show(done());
      },
      error: (error: unknown) => {
        settle();
        const response = error instanceof HttpErrorResponse ? error : null;
        const title = (response?.error as { title?: unknown } | null)?.title;
        this.toasts.show({
          tone: 'danger',
          title: `${project.name} wasn’t ${action === 'archive' ? 'archived' : 'restored'}`,
          text: archiveRefusal(response?.status ?? 0, typeof title === 'string' ? title : null),
        });
      },
    });
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
