import { Dialog } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  applyEvent,
  Direction,
  LogLine,
  Project,
  PROJECT_EVENTS,
  ProjectEvent,
  PROJECTS_API,
  StageDetail,
} from '@hewn/api';
import { IconComponent, StatusComponent, StatusIconComponent, StatusName } from '@hewn/components';
import {
  asyncScheduler,
  auditTime,
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  expand,
  filter,
  map,
  merge,
  Observable,
  of,
  reduce,
  scan,
  shareReplay,
  startWith,
  switchMap,
  throttleTime,
  timer,
} from 'rxjs';
import { SessionStore } from '../../core/session-store';
import { Toasts } from '../../core/toasts';
import { BacklogComponent } from './backlog.component';
import { DesignsComponent } from './designs.component';
import { DesignSystemComponent } from './design-system.component';
import { ArtifactsComponent } from './artifacts.component';
import { LiveLogComponent } from './live-log.component';
import { RaiseBudgetDialog, RaiseBudgetData } from './raise-budget.dialog';
import { suggestedBudget } from './raise-budget';
import { CancelDirectionData, CancelDirectionDialog } from './cancel-direction.dialog';
import {
  blockedBody,
  blockedTitle,
  blockedToast,
  canRetryStage,
  retryCountdown,
  retryFailure,
} from './retry-stage';
import {
  canCancel,
  cancelledBody,
  cancelledTitle,
  controlFailure,
  directionControl,
  PAUSED_BY_OWNER,
  pausedTitle,
} from './direction-controls';
import {
  budgetWarningToast,
  clockTime,
  dollars,
  directionTitle,
  featureOutcome,
  formatDuration,
  headerStatus,
  logTime,
  mergeLines,
  selectedStage,
  spendView,
  STAGE_META,
  stageNotice,
} from './pipeline-view';

type Loaded =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; project: Project };

type Tab = 'log' | 'runs' | 'artifacts' | 'decisions';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'runs', label: 'Runs' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'decisions', label: 'Decisions' },
];

/** Events that change what a selected stage's detail lists. */
const DETAIL_EVENTS = new Set([
  'StageChanged',
  'StepStarted',
  'DecisionRecorded',
  'RunRetryScheduled',
  'StageBlocked',
]);

/** Stage changes are announced at most once every 5 seconds per project (L2-047 AC3). */
export const ANNOUNCE_EVERY_MS = 5000;

/** A page of a log; the API returns at most this many lines a request. */
const LOG_PAGE = 5000;

/**
 * The project page (L2-030): the pipeline with each stage's status, duration and, while running, its step and
 * latest log line; the selected stage's runs, log, artifacts and decisions. Kept current by the live event stream.
 */
/** Events after which the backlog or its totals may differ: a plan, an increment's progress, a stage, a direction. */
const BACKLOG_EVENTS = new Set([
  'BacklogPlanned',
  'IncrementChanged',
  'StageChanged',
  'DirectionChanged',
]);

@Component({
  selector: 'hw-project-page',
  imports: [
    RouterLink,
    IconComponent,
    StatusComponent,
    StatusIconComponent,
    LiveLogComponent,
    BacklogComponent,
    DesignsComponent,
    DesignSystemComponent,
    ArtifactsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project.page.html',
})
export class ProjectPage {
  private readonly api = inject(PROJECTS_API);
  private readonly events = inject(PROJECT_EVENTS);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(Toasts);
  protected readonly session = inject(SessionStore);

  readonly projectId = input.required<string>();
  /** `?stage=` from the URL: the stage the user selected. */
  readonly stage = input<string>();
  /** The section tab, from the route's data: the pipeline, or `/projects/{id}/` backlog, designs, design-system or artifacts. */
  readonly section = input<'pipeline' | 'backlog' | 'designs' | 'design-system' | 'artifacts'>(
    'pipeline',
  );

  /** Bumped by "Try again" to load the project once more. */
  private readonly attempt = signal(0);

  /** The snapshot from GET, then every later event folded in. */
  private readonly live$: Observable<{ loaded: Loaded; event: ProjectEvent | null }> =
    combineLatest([toObservable(this.projectId), toObservable(this.attempt)]).pipe(
      switchMap(([id]) =>
        this.api.getProject(id).pipe(
          switchMap((snapshot) =>
            this.events.follow(id, snapshot.lastSequence).pipe(
              scan(
                (acc, event) => ({
                  project: applyEvent(acc.project, event),
                  event: event as ProjectEvent | null,
                }),
                { project: snapshot, event: null as ProjectEvent | null },
              ),
              startWith({ project: snapshot, event: null }),
              map(({ project, event }) => ({
                loaded: { state: 'ready', project } as Loaded,
                event,
              })),
            ),
          ),
          catchError((error: unknown) =>
            of({
              loaded: {
                state:
                  error instanceof HttpErrorResponse && error.status === 404 ? 'missing' : 'error',
              } as Loaded,
              event: null,
            }),
          ),
          startWith({ loaded: { state: 'loading' } as Loaded, event: null }),
        ),
      ),
      // One GET and one hub follow, shared by the page state, the stage detail, the log and the announcer.
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  /**
   * Each live event once per subscriber. A subscriber that joins later also gets the latest one again, which is
   * harmless: log lines are merged by line number, and the detail is simply reloaded.
   */
  private readonly events$: Observable<ProjectEvent> = this.live$.pipe(
    map(({ event }) => event),
    filter((event): event is ProjectEvent => event !== null),
    distinctUntilChanged((a, b) => a.sequence === b.sequence),
  );

  /** Counts the events that can change the backlog, so the Backlog tab reads it again after each (L2-025 AC4). */
  protected readonly backlogChanges = toSignal(
    this.events$.pipe(
      filter((e) => BACKLOG_EVENTS.has(e.type)),
      scan((n) => n + 1, 0),
    ),
    { initialValue: 0 },
  );

  /** Counts stage changes, so the Artifacts tab reads them again when a stage succeeds (L2-034 AC1). */
  protected readonly artifactChanges = toSignal(
    this.events$.pipe(
      filter((e) => e.type === 'StageChanged'),
      scan((n) => n + 1, 0),
    ),
    { initialValue: 0 },
  );

  private readonly live = toSignal(this.live$, {
    initialValue: { loaded: { state: 'loading' } as Loaded, event: null },
  });

  protected readonly loaded = computed(() => this.live().loaded);

  protected readonly project = computed(() => {
    const loaded = this.loaded();
    return loaded.state === 'ready' ? loaded.project : null;
  });

  /** The direction being worked on, or the latest one. */
  protected readonly direction = computed<Direction | null>(() => {
    const directions = this.project()?.directions ?? [];
    return (
      directions.find((d) => d.status === 'Running' || d.status === 'Paused') ??
      directions.find((d) => d.status === 'Queued') ??
      directions.at(-1) ??
      null
    );
  });

  /** Directions waiting behind the one shown, first in, first out (L2-004 AC4, L2-005 AC4). */
  protected readonly queued = computed(() => {
    const shown = this.direction();
    return (this.project()?.directions ?? []).filter(
      (d) => d.status === 'Queued' && d.id !== shown?.id,
    );
  });

  /** The stage the detail panel shows (L2-030 AC3). */
  protected readonly selected = computed(() => {
    const direction = this.direction();
    if (!direction) return null;
    const number = selectedStage(direction.stages, this.stage());
    return direction.stages.find((s) => s.number === number) ?? null;
  });

  protected readonly meta = computed(() => {
    const stage = this.selected();
    return stage ? STAGE_META[stage.number] : null;
  });

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('log');

  /** Which stage's detail to load; a change of status refreshes it as well. */
  private readonly detailKey = computed(() => {
    const direction = this.direction();
    const stage = this.selected();
    return direction && stage
      ? { projectId: this.projectId(), directionId: direction.id, stage: stage.number }
      : null;
  });

  /** The selected stage's runs, artifacts and decisions, reloaded when an event touches them. */
  protected readonly detail = toSignal(
    toObservable(this.detailKey).pipe(
      distinctUntilChanged(
        (a, b) =>
          a?.directionId === b?.directionId &&
          a?.stage === b?.stage &&
          a?.projectId === b?.projectId,
      ),
      switchMap((key) =>
        key === null
          ? of(null)
          : merge(
              of(null),
              this.events$.pipe(
                filter(
                  (e) =>
                    DETAIL_EVENTS.has(e.type) &&
                    e.payload['directionId'] === key.directionId &&
                    e.payload['stage'] === key.stage,
                ),
                auditTime(250),
              ),
            ).pipe(
              switchMap(() =>
                this.api
                  .getStageDetail(key.projectId, key.directionId, key.stage)
                  .pipe(catchError(() => of(null))),
              ),
              startWith(null as StageDetail | null),
            ),
      ),
    ),
    { initialValue: null },
  );

  /** The run whose log the Log tab shows: the live run, else the stage's newest. */
  private readonly logRun = computed(() => {
    const stage = this.selected();
    const runId = stage?.runId ?? this.detail()?.runs[0]?.id ?? null;
    return runId ? { projectId: this.projectId(), runId } : null;
  });

  /** The selected run's log: every stored line, then lines as they arrive (L2-033 AC1). */
  protected readonly logLines = toSignal(
    toObservable(this.logRun).pipe(
      distinctUntilChanged((a, b) => a?.runId === b?.runId),
      switchMap((run) => {
        if (!run) return of([] as LogLine[]);
        const stored$ = this.api.getRunLog(run.projectId, run.runId, 0, LOG_PAGE).pipe(
          expand((page) =>
            page.length < LOG_PAGE
              ? EMPTY
              : this.api.getRunLog(run.projectId, run.runId, page.at(-1)!.line, LOG_PAGE),
          ),
          reduce((all, page) => all.concat(page), [] as LogLine[]),
          catchError(() => of([] as LogLine[])),
        );
        const arriving$ = this.events$.pipe(
          filter((e) => e.type === 'LogLines' && e.payload['runId'] === run.runId),
          map((e) => (e.payload['lines'] as LogLine[] | undefined) ?? []),
        );
        return merge(stored$, arriving$).pipe(
          scan((shown, lines) => mergeLines(shown, lines), [] as LogLine[]),
          startWith([] as LogLine[]),
        );
      }),
    ),
    { initialValue: [] as LogLine[] },
  );

  /** The text shown instead of a log for a stage that hasn't run. */
  protected readonly notice = computed(() => {
    const stage = this.selected();
    const direction = this.direction();
    if (!stage || !direction) return null;
    // A queued run that no worker has leased yet has nothing to show.
    if (this.detail()?.runs.some((r) => r.startedAt !== null)) return null;
    const first = direction.stages.find((s) => s.status !== 'Skipped')?.number ?? 0;
    return stageNotice(stage, first);
  });

  /** The shown direction's spend of its budget (L2-052 AC2), warning from 80% (L2-053 AC2). */
  protected readonly spend = computed(() => {
    const d = this.direction();
    return d ? spendView(d.spendUsd, d.budgetUsd, d.budgetWarned, d.pauseReason) : null;
  });

  /** The project's total, shown when earlier directions spent too. */
  protected readonly projectSpend = computed(() => {
    const p = this.project();
    const d = this.direction();
    return p && d && p.spendUsd !== d.spendUsd ? dollars(p.spendUsd) : null;
  });

  protected readonly budgetReached = 'Budget reached';

  protected budgetReachedText(spendUsd: number, budgetUsd: number): string {
    const next = this.session.isOwner()
      ? 'Raise the budget, then Resume.'
      : 'Nothing more runs until an Owner raises the budget.';
    return `Spend hit ${dollars(spendUsd)} of ${dollars(budgetUsd)} after the current model call. ${next} This is a safety stop, not an approval.`;
  }

  /** The new budget typed into the budget-reached callout, per direction; it starts $100 above the budget. */
  private readonly newBudgets = signal<Record<string, string>>({});

  protected newBudget(direction: { id: string; budgetUsd: number }): string {
    return this.newBudgets()[direction.id] ?? suggestedBudget(direction.budgetUsd);
  }

  protected setNewBudget(directionId: string, value: string): void {
    this.newBudgets.update((all) => ({ ...all, [directionId]: value }));
  }

  protected readonly control = directionControl;
  protected readonly pausedTitle = pausedTitle;
  protected readonly canCancel = canCancel;
  protected readonly cancelledTitle = cancelledTitle;
  protected readonly cancelledBody = cancelledBody;

  /** "8 Nov", for the cancelled direction's meta line. */
  protected shortDate(at: string | null): string {
    return at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  }

  /** Cancel (L2-029 AC3), confirmed in a dialog. The page updates from the events the command sends. */
  protected cancelDirection(direction: { id: string }): void {
    const project = this.project();
    if (!project || !this.session.isOwner()) return;
    this.dialog.open<unknown, CancelDirectionData>(CancelDirectionDialog, {
      data: { projectId: project.id, projectName: project.name, directionId: direction.id },
      role: 'alertdialog',
      ariaLabelledBy: 'cancel-title',
      ariaDescribedBy: 'cancel-desc',
      backdropClass: 'backdrop',
      autoFocus: 'first-tabbable',
    });
  }
  protected readonly pausedByOwner = PAUSED_BY_OWNER;
  protected readonly canRetryStage = canRetryStage;
  protected readonly blockedTitle = blockedTitle;
  protected readonly blockedBody = blockedBody;
  /** True while a Retry stage request is on its way. */
  protected readonly retrySending = signal(false);

  /** "Retry 1 of 3 in 0:24" on the stage an automatic retry is waiting for (L2-006 AC1); ticks each second. */
  protected retryLine(stage: number): string | null {
    const retry = this.direction()?.retry;
    return retry && retry.stage === stage ? retryCountdown(retry, this.now()) : null;
  }

  /** Retry stage (L2-006 AC3): the failed stage runs again from its start. The page updates from the events. */
  protected retryStage(directionId: string): void {
    const project = this.project();
    if (!project || !this.session.isOwner() || this.retrySending()) return;
    this.retrySending.set(true);
    this.api.retryStage(project.id, directionId).subscribe({
      next: () => this.retrySending.set(false),
      error: (error: unknown) => {
        this.retrySending.set(false);
        this.toasts.show({
          tone: 'warn',
          title: `${project.name} wasn’t retried`,
          text: retryFailure(error instanceof HttpErrorResponse ? error.status : 0),
        });
      },
    });
  }
  /** True while a Pause or Resume request is on its way. */
  protected readonly controlSending = signal(false);

  /**
   * Pause or Resume (L2-029 AC1, AC2). The page updates from the events the command sends: Pausing… while the
   * step in progress finishes, then Paused; Running again on Resume.
   */
  protected sendControl(direction: { id: string }, action: 'pause' | 'resume'): void {
    const project = this.project();
    if (!project || !this.session.isOwner() || this.controlSending()) return;
    this.controlSending.set(true);
    const request =
      action === 'pause'
        ? this.api.pause(project.id, direction.id)
        : this.api.resume(project.id, direction.id);
    request.subscribe({
      next: () => this.controlSending.set(false),
      error: (error: unknown) => {
        this.controlSending.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.toasts.show({
          tone: 'warn',
          title: `${project.name} wasn’t ${action === 'pause' ? 'paused' : 'resumed'}`,
          text: controlFailure(action, status),
        });
      },
    });
  }

  /** Raise and resume (L2-053 AC3). The page updates from the events the command sends. */
  protected raiseAndResume(direction: { id: string; budgetUsd: number; spendUsd: number }): void {
    const project = this.project();
    if (!project || !this.session.isOwner()) return;
    const ref = this.dialog.open<unknown, RaiseBudgetData>(RaiseBudgetDialog, {
      data: {
        projectId: project.id,
        projectName: project.name,
        directionId: direction.id,
        budgetUsd: direction.budgetUsd,
        spendUsd: direction.spendUsd,
        initial: this.newBudget(direction),
      },
      ariaLabelledBy: 'raise-title',
      ariaDescribedBy: 'raise-desc',
      backdropClass: 'backdrop',
      autoFocus: '#new-budget',
    });
    ref.closed.subscribe((result) => {
      if (!result) return;
      this.newBudgets.update((all) => {
        const rest = { ...all };
        delete rest[direction.id];
        return rest;
      });
    });
  }

  protected readonly title = directionTitle;
  protected readonly clockTime = clockTime;
  protected readonly logTime = logTime;
  protected readonly featureOutcome = featureOutcome;

  protected readonly status = computed(() => {
    const project = this.project();
    return project ? headerStatus(project.status, this.direction()?.status ?? null) : 'Idle';
  });

  /** Ticks once a second so a running stage's duration counts up. */
  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  /** Stage changes for the polite live region, at most one announcement every 5 seconds (the latest wins). */
  protected readonly announcement = toSignal(
    this.events$.pipe(
      filter((event) => event.type === 'StageChanged'),
      throttleTime(ANNOUNCE_EVERY_MS, asyncScheduler, { leading: true, trailing: true }),
      map(
        (event) =>
          `Stage ${event.payload['stage']}, ${event.payload['name']}, ${event.payload['status']}`,
      ),
    ),
    { initialValue: '' },
  );

  constructor() {
    // L2-053 AC2: the 80% warning, pushed live. The meter keeps showing it after the toast leaves.
    const toasts = inject(Toasts);
    // L2-006 AC2: a stage blocked after its retries; the toast stays until dismissed and offers the way back.
    this.events$
      .pipe(
        filter((event) => event.type === 'StageBlocked'),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const project = this.project();
        const stage = event.payload['stage'] as number;
        const directionId = event.payload['directionId'] as string;
        toasts.show({
          ...blockedToast(
            project?.name ?? 'This project',
            event.payload['stageName'] as string,
            (event.payload['attempts'] as number) - 1,
          ),
          actions: [
            { label: 'Open log', link: ['/projects', event.projectId], queryParams: { stage } },
            ...(this.session.isOwner()
              ? [{ label: 'Retry stage', run: () => this.retryStage(directionId) }]
              : []),
          ],
        });
      });
    this.events$
      .pipe(
        filter((event) => event.type === 'BudgetWarning'),
        takeUntilDestroyed(),
      )
      .subscribe((event) =>
        toasts.show(
          budgetWarningToast(
            this.project()?.name ?? 'This project',
            event.payload['spendUsd'] as number,
            event.payload['budgetUsd'] as number,
          ),
        ),
      );
  }

  protected duration(startedAt: string | null, endedAt: string | null): string {
    return formatDuration(startedAt, endedAt, endedAt ? 0 : this.now());
  }

  protected runStatus(status: string): StatusName {
    return status as StatusName;
  }

  protected shortId(id: string): string {
    return `run-${id.slice(0, 8)}`;
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  /** Arrow keys, Home and End move between tabs, as the WAI-ARIA tabs pattern asks. */
  protected onTabKey(event: KeyboardEvent, index: number): void {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length]!;
    this.tab.set(target.id);
    document.getElementById(`stage-tab-${target.id}`)?.focus();
  }
}
