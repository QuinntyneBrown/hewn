import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BudgetReachedError,
  LeaseLostError,
  TokenRefusedError,
  type HewnApi,
  type LeasedRun,
  type WorkerRegistration,
} from './api.ts';
import type { RunContext, StageExecutor } from './executors/stage-executor.ts';
import { LogBatcher } from './log-batcher.ts';
import { startRunIsolation, type IsolationSettings } from './isolation/run-isolation.ts';
import { sleep } from './sleep.ts';
import { currentSpan, Tracer, withTrace } from './tracing.ts';

export type Log = (message: string, fields?: Record<string, unknown>) => void;

export interface WorkLoopOptions {
  api: HewnApi;
  executor: StageExecutor;
  registration: WorkerRegistration;
  log: Log;
  /** Idle polling interval; L2-026 allows no more often than every 15 seconds. */
  pollIntervalMs?: number;
  /** How long the API holds an idle lease request, waiting to push work (at most 30). */
  leaseWaitSeconds?: number;
  heartbeatIntervalMs?: number;
  /** How long each control poll is held open by the API. */
  controlWaitSeconds?: number;
  /** Each run's egress proxy, command sandbox and tool gates (L2-042); none when absent. */
  isolation?: IsolationSettings;
  /** Spans for each run and its model calls, in the trace the lease hands over (L2-049 AC2); dropped when absent. */
  tracer?: Tracer;
}

/**
 * Register, wait for work, lease one run, heartbeat while it executes, checkpoint after each step, report
 * the result, repeat. A lost lease (409, or two missed heartbeats) stops the run and nothing more is reported.
 */
export class WorkLoop {
  private readonly api: HewnApi;
  private readonly executor: StageExecutor;
  private readonly registration: WorkerRegistration;
  private readonly log: Log;
  private readonly tracer: Tracer;
  private readonly pollIntervalMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly leaseWaitSeconds: number;
  private readonly isolation: IsolationSettings | undefined;
  private readonly controlWaitSeconds: number;

  constructor(options: WorkLoopOptions) {
    this.api = options.api;
    this.tracer = options.tracer ?? new Tracer();
    this.executor = options.executor;
    this.registration = options.registration;
    this.log = options.log;
    this.pollIntervalMs = Math.max(options.pollIntervalMs ?? 15_000, 15_000);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000;
    this.controlWaitSeconds = options.controlWaitSeconds ?? 20;
    this.leaseWaitSeconds = options.leaseWaitSeconds ?? 20;
    this.isolation = options.isolation;
  }

  /** Set once the API refuses this worker's token (L2-041): the run in hand stops and the loop ends. */
  private refused = false;

  async run(signal: AbortSignal): Promise<void> {
    const workerId = await this.api.register(this.registration);
    this.log('Registered', { workerId, location: this.registration.location });

    while (!signal.aborted) {
      // Idle: the API holds the request and answers when work is queued (its push). Whatever it answers, ask
      // again no sooner than the polling interval after the last ask (L2-026 AC5).
      let run: LeasedRun | null = null;
      const asked = Date.now();
      try {
        run = await this.api.lease(workerId, this.leaseWaitSeconds, signal);
      } catch (error) {
        if (signal.aborted) break;
        if (error instanceof TokenRefusedError) this.refused = true;
        else this.log('Lease request failed', { level: 'Warning', error: messageOf(error) });
      }

      if (this.refused) break;

      if (run === null) {
        await sleep(Math.max(0, this.pollIntervalMs - (Date.now() - asked)), signal);
        continue;
      }

      await this.execute(workerId, run, signal);
      if (this.refused) break;
    }

    // Revoked or expired: nothing this worker sends will be accepted, so it disconnects (L2-041 AC2, AC3).
    if (this.refused) this.log('The API refused this worker’s token (revoked or expired); stopping');
  }

  /** True when the loop ended because the API refused the token, so the process can exit non-zero. */
  get tokenRefused(): boolean {
    return this.refused;
  }

  /** Logs with the run's project, direction, stage and run IDs on the entry (L2-049 AC1). */
  private logRun(run: LeasedRun, message: string, fields?: Record<string, unknown>): void {
    this.log(message, {
      projectId: run.projectId,
      directionId: run.directionId,
      stage: run.stage,
      runId: run.runId,
      ...(currentSpan() ? { traceId: currentSpan()!.traceId } : {}),
      ...fields,
    });
  }

  /** Runs the leased run inside its span, under the lease's span for the run's time in the queue. */
  private async execute(workerId: string, run: LeasedRun, stop: AbortSignal): Promise<void> {
    const span = this.tracer.start(`Run stage ${run.stage}`, {
      traceParent: run.traceParent,
      attributes: {
        'hewn.project.id': run.projectId,
        'hewn.direction.id': run.directionId,
        'hewn.stage': run.stage,
        'hewn.run.id': run.runId,
        'hewn.run.epoch': run.epoch,
      },
    });
    try {
      await withTrace(span, () => this.executeRun(workerId, run, stop));
    } finally {
      span.end();
    }
  }

  private async executeRun(workerId: string, run: LeasedRun, stop: AbortSignal): Promise<void> {
    this.logRun(run, 'Leased run', {
      runId: run.runId,
      stage: run.stage,
      epoch: run.epoch,
      checkpointStep: run.checkpointStep,
    });
    const lease = new AbortController();
    const onStop = () => lease.abort(stop.reason);
    stop.addEventListener('abort', onStop, { once: true });

    let missed = 0;
    const heartbeat = setInterval(async () => {
      try {
        await this.api.heartbeat(workerId, run);
        missed = 0;
      } catch (error) {
        if (error instanceof TokenRefusedError) {
          this.refused = true;
          lease.abort(error);
        } else if (error instanceof LeaseLostError) {
          this.logRun(run, 'Lease lost', { runId: run.runId });
          lease.abort(error);
        } else if (++missed >= 2) {
          this.logRun(run, 'Two heartbeats missed; stopping the run', { level: 'Warning' });
          lease.abort(new LeaseLostError('Two heartbeats missed.'));
        }
      }
    }, this.heartbeatIntervalMs);

    void this.listenForControl(workerId, run, lease);

    const logs = new LogBatcher(
      (lines) => this.api.log(workerId, run, lines),
      (error) => this.logRun(run, 'Could not send log lines', { level: 'Warning', error: messageOf(error) }),
    );

    // Synchronous on purpose: one small directory per run, and no I/O race with the heartbeat timer.
    const workspace = mkdtempSync(join(tmpdir(), `hewn-run-${run.runId}-`));
    let isolated: Awaited<ReturnType<typeof startRunIsolation>> | null = null;
    const context: RunContext = {
      workspace,
      log: async (level, text) => logs.add({ level, text }),
      listSkillFolders: () => this.api.listSkillFolders(workerId, run),
      downloadRepository: () => this.api.downloadRepository(workerId, run),
      commit: (step, message, files, branch, options) =>
        this.api.commit(workerId, run, `${run.runId}/${step}/commit`, message, files, branch, options),
      nextIncrement: () => this.api.nextIncrement(workerId, run),
      updateIncrement: (number, update) => this.api.updateIncrement(workerId, run, number, update),
      openPullRequest: (step, request) =>
        this.api.openPullRequest(workerId, run, `${run.runId}/${step}/pull-request`, request),
      pullRequestChecks: (number) => this.api.pullRequestChecks(workerId, run, number),
      reportBacklog: (report) => this.api.reportBacklog(workerId, run, report),
      reportScope: (report) => this.api.reportScope(workerId, run, report),
      recordDecisions: (decisions) => this.api.recordDecisions(workerId, run, decisions),
      recordModelCall: async ({ startedAt, ...call }) => {
        const span = this.tracer.start('Model call', {
          parent: currentSpan(),
          kind: 'client',
          startMs: startedAt,
          attributes: {
            'gen_ai.request.model': call.model,
            'gen_ai.usage.input_tokens': call.inputTokens,
            'gen_ai.usage.output_tokens': call.outputTokens,
          },
        });
        const { verdict, directionSpendUsd, budgetUsd } = await withTrace(span, () =>
          this.api.recordModelCall(workerId, run, { callId: randomUUID(), ...call }),
        ).finally(() => span.end());
        const spend = `${dollars(directionSpendUsd)} of ${dollars(budgetUsd)}`;
        if (verdict === 'Warn') logs.add({ level: 'warn', text: `Spend at 80% of budget (${spend})` });
        if (verdict === 'Stop') {
          // Hewn has paused the direction and released the lease; nothing more of this run may reach it.
          this.logRun(run, 'Budget reached; the direction is Paused', { runId: run.runId, spend });
          const reached = new BudgetReachedError(`Budget reached (${spend}).`);
          lease.abort(reached);
          throw reached;
        }
      },
      mergePullRequest: (step, number) =>
        this.api.mergePullRequest(workerId, run, `${run.runId}/${step}/merge`, number),
      protectDefaultBranch: (step, checks) =>
        this.api.protectDefaultBranch(workerId, run, `${run.runId}/${step}/protect`, checks),
    };

    try {
      if (this.isolation) {
        isolated = await startRunIsolation(this.isolation, run.runId, (level, text) => logs.add({ level, text }));
        context.isolation = isolated.isolation;
      }
      const steps = this.executor.plan(run, context);
      for (let index = run.checkpointStep; index < steps.length; index++) {
        await this.api.startStep(workerId, run, index + 1, steps[index]!.name);
        await steps[index]!.execute(lease.signal);
        if (lease.signal.aborted) return;
        await logs.flush();
        const verdict = await this.api.checkpoint(workerId, run, index + 1);
        this.logRun(run, 'Checkpoint', { runId: run.runId, step: index + 1 });
        if (verdict === 'Pause') {
          // An Owner pressed Pause: Hewn has paused the direction at this checkpoint and released the lease.
          this.logRun(run, 'Paused at a checkpoint; the run stops here', { runId: run.runId, step: index + 1 });
          lease.abort(new Error('Paused at a checkpoint.'));
          return;
        }
      }

      if (lease.signal.aborted) return;
      await logs.close();
      await this.api.result(workerId, run, { outcome: 'Succeeded' });
      this.logRun(run, 'Run succeeded', { runId: run.runId, stage: run.stage });
    } catch (error) {
      if (error instanceof TokenRefusedError) this.refused = true;
      if (error instanceof LeaseLostError && !lease.signal.aborted) {
        // A write was refused: often a cancel or halt whose answer to the held poll hasn't arrived yet. Stop now,
        // then ask once more so the API hears that this worker stopped.
        lease.abort(error);
        await this.confirmStop(workerId, run);
        return;
      }
      if (lease.signal.aborted || error instanceof LeaseLostError || error instanceof TokenRefusedError) return;
      currentSpan()?.fail(messageOf(error));
      this.logRun(run, 'Run failed', { level: 'Warning' });
      await logs.close();
      await this.api
        .result(workerId, run, { outcome: 'Failed', error: messageOf(error) })
        .catch((reportError: unknown) =>
          this.logRun(run, 'Could not report the failure', { level: 'Error', error: messageOf(reportError) }),
        );
    } finally {
      // Ends the control poll as well.
      if (!lease.signal.aborted) lease.abort(new Error('The run ended.'));
      clearInterval(heartbeat);
      void logs.close();
      stop.removeEventListener('abort', onStop);
      rmSync(workspace, { recursive: true, force: true });
      void isolated?.stop();
    }
  }

  /** One unheld control poll after a refused write; Cancel or Halt there is acknowledged by the API as it answers. */
  private async confirmStop(workerId: string, run: LeasedRun): Promise<void> {
    try {
      const control = await this.api.control(workerId, run, 0, AbortSignal.timeout(5_000));
      if (control === 'Cancel') this.logRun(run, 'Cancelled; the run stops now', { runId: run.runId });
      else if (control === 'Halt')
        this.logRun(run, 'Halted: all workers stopped; the run waits at its checkpoint', { runId: run.runId });
      else this.logRun(run, 'Lease lost', { runId: run.runId });
    } catch {
      this.logRun(run, 'Lease lost', { runId: run.runId });
    }
  }

  /**
   * Holds the control poll open while the run executes. Cancel (L2-029 AC3) and Halt (Stop all workers, AC4) abort
   * the step in progress at once; the API has already taken the run back, so nothing more is reported. A halted run
   * keeps its checkpoint and is leased again after Start workers.
   */
  private async listenForControl(workerId: string, run: LeasedRun, lease: AbortController): Promise<void> {
    while (!lease.signal.aborted) {
      try {
        const control = await this.api.control(workerId, run, this.controlWaitSeconds, lease.signal);
        if (control === 'Cancel') {
          this.logRun(run, 'Cancelled; the run stops now', { runId: run.runId });
          lease.abort(new Error('Cancelled by an Owner.'));
          return;
        }
        if (control === 'Halt') {
          this.logRun(run, 'Halted: all workers stopped; the run waits at its checkpoint', { runId: run.runId });
          lease.abort(new Error('All workers stopped by an Owner.'));
          return;
        }
      } catch (error) {
        if (lease.signal.aborted) return;
        // The API took the run back (a revoked token, L2-041 AC2): stop now rather than at the next heartbeat.
        if (error instanceof LeaseLostError || error instanceof TokenRefusedError) {
          if (error instanceof TokenRefusedError) this.refused = true;
          else this.logRun(run, 'Lease lost', { runId: run.runId });
          lease.abort(error);
          return;
        }
        await sleep(1_000, lease.signal);
      }
    }
  }
}

function dollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
