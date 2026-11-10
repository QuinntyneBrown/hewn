import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import type { ProjectSummary } from '../projects/models';
import { ProjectEvent } from './project-event';
import { ConnectionStatus, Reconnector } from './reconnector';

/** What a reconnect caught up: how many missed events, and their sequence numbers. */
export interface CatchUp {
  count: number;
  from: number | null;
  to: number | null;
}

/**
 * Live project events. The client owns the hub connection, reconnects, and catch-up by sequence number:
 * subscribers receive every event after `afterSequence` exactly once, in order. Components never open a hub.
 */
export interface ProjectEvents {
  follow(projectId: string, afterSequence: number): Observable<ProjectEvent>;
  /**
   * Every project's row as it changes (L2-002 AC4). After a reconnect it emits `resync`, since rows may have
   * changed while the connection was down; the list then loads again.
   */
  followProjects(): Observable<ProjectsUpdate>;
  /**
   * Emits whenever a worker registers, leases or finishes a run, and after a reconnect, so the Workers view reads the
   * list again and a new worker shows within 2 seconds (L2-026 AC1).
   */
  followWorkers(): Observable<void>;
  /** Connecting, live, reconnecting or offline, with the next attempt's time (L2-032 AC1). */
  status(): Observable<ConnectionStatus>;
  /** Emits once each reconnect has caught up every followed project (L2-032 AC2, AC3). */
  caughtUp(): Observable<CatchUp>;
  /** The highest sequence number applied so far, where missed events will catch up from; null before any. */
  lastSequence(): number | null;
  /** Tries to reconnect at once instead of waiting for the next attempt. */
  retryNow(): void;
}

export type ProjectsUpdate = { kind: 'row'; row: ProjectSummary } | { kind: 'resync' };

export const PROJECT_EVENTS = new InjectionToken<ProjectEvents>('ProjectEvents');

@Injectable()
export class SignalRProjectEvents implements ProjectEvents, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly connection: HubConnection = new HubConnectionBuilder()
    .withUrl('/hubs/mission-control')
    .configureLogging(LogLevel.Warning)
    .build();
  private starting: Promise<void> | null = null;
  private destroyed = false;
  private highest: number | null = null;
  /** What each subscription does after a reconnect: join its group again and catch up. */
  private readonly rejoins = new Set<() => Promise<CatchUp | void>>();
  private readonly caught = new Subject<CatchUp>();
  // Not SignalR's automatic reconnect: L2-032 wants retries for as long as it takes, and Retry now.
  private readonly reconnector = new Reconnector(() => this.reconnect());

  constructor() {
    this.connection.onclose(() => {
      if (!this.destroyed) this.reconnector.dropped();
    });
  }

  status(): Observable<ConnectionStatus> {
    return this.reconnector.status$.asObservable();
  }

  caughtUp(): Observable<CatchUp> {
    return this.caught.asObservable();
  }

  lastSequence(): number | null {
    return this.highest;
  }

  retryNow(): void {
    void this.reconnector.retryNow();
  }

  follow(projectId: string, afterSequence: number): Observable<ProjectEvent> {
    return new Observable<ProjectEvent>((subscriber) => {
      let last = afterSequence;
      let closed = false;
      // Live events that arrive while a catch-up request is in flight wait here, then drain in order.
      let catchingUp = true;
      const buffered: ProjectEvent[] = [];

      // Counts what a catch-up after a reconnect applies, for the Reconnected notice.
      let missed: CatchUp | null = null;
      const emit = (event: ProjectEvent) => {
        if (event.sequence <= last) return;
        last = event.sequence;
        this.highest = Math.max(this.highest ?? 0, event.sequence);
        if (missed) {
          missed.count++;
          missed.from ??= event.sequence;
          missed.to = event.sequence;
        }
        subscriber.next(event);
      };

      const onEvent = (event: ProjectEvent) => {
        if (event.projectId !== projectId) return;
        if (catchingUp) buffered.push(event);
        else emit(event);
      };

      const catchUp = async () => {
        catchingUp = true;
        try {
          await this.connection.invoke('JoinProject', projectId);
          let page: ProjectEvent[];
          do {
            page = await firstValueFrom(
              this.http.get<ProjectEvent[]>(
                `/api/projects/${encodeURIComponent(projectId)}/events`,
                {
                  params: { after: last },
                },
              ),
            );
            page.forEach(emit);
          } while (page.length > 0 && !closed);
        } finally {
          buffered
            .sort((a, b) => a.sequence - b.sequence)
            .splice(0)
            .forEach(emit);
          catchingUp = false;
        }
      };

      const rejoin = async (): Promise<CatchUp> => {
        missed = { count: 0, from: null, to: null };
        try {
          await catchUp();
          return missed;
        } finally {
          missed = null;
        }
      };

      this.connection.on('ProjectEvent', onEvent);
      this.rejoins.add(rejoin);
      // If the first start fails, the reconnect schedule joins and catches up instead.
      this.ensureStarted().then(
        () => (closed ? undefined : catchUp().catch((error: unknown) => subscriber.error(error))),
        () => undefined,
      );

      return () => {
        closed = true;
        this.rejoins.delete(rejoin);
        this.connection.off('ProjectEvent', onEvent);
        if (this.connection.state === HubConnectionState.Connected) {
          void this.connection.invoke('LeaveProject', projectId).catch(() => undefined);
        }
      };
    });
  }

  followProjects(): Observable<ProjectsUpdate> {
    return new Observable<ProjectsUpdate>((subscriber) => {
      let closed = false;
      const onRow = (row: ProjectSummary) => subscriber.next({ kind: 'row', row });
      const join = () => this.connection.invoke('JoinProjects');
      const rejoin = async () => {
        await join();
        subscriber.next({ kind: 'resync' });
      };

      this.connection.on('ProjectSummary', onRow);
      this.rejoins.add(rejoin);
      this.ensureStarted().then(
        () => (closed ? undefined : join().catch((error: unknown) => subscriber.error(error))),
        () => undefined,
      );

      return () => {
        closed = true;
        this.rejoins.delete(rejoin);
        this.connection.off('ProjectSummary', onRow);
        if (this.connection.state === HubConnectionState.Connected) {
          void this.connection.invoke('LeaveProjects').catch(() => undefined);
        }
      };
    });
  }

  followWorkers(): Observable<void> {
    return new Observable<void>((subscriber) => {
      let closed = false;
      const onChanged = () => subscriber.next();
      const join = () => this.connection.invoke('JoinWorkers');
      const rejoin = async () => {
        await join();
        subscriber.next();
      };

      this.connection.on('WorkersChanged', onChanged);
      this.rejoins.add(rejoin);
      this.ensureStarted().then(
        () => (closed ? undefined : join().catch((error: unknown) => subscriber.error(error))),
        () => undefined,
      );

      return () => {
        closed = true;
        this.rejoins.delete(rejoin);
        this.connection.off('WorkersChanged', onChanged);
        if (this.connection.state === HubConnectionState.Connected) {
          void this.connection.invoke('LeaveWorkers').catch(() => undefined);
        }
      };
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.reconnector.stop();
    void this.connection.stop();
  }

  /** Starts the connection once; a failed first start hands over to the reconnect schedule. */
  private ensureStarted(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) return Promise.resolve();
    this.starting ??= this.connection
      .start()
      .then(
        () => this.reconnector.connected(),
        (error: unknown) => {
          this.reconnector.dropped();
          throw error;
        },
      )
      .finally(() => (this.starting = null));
    return this.starting;
  }

  /** One reconnect attempt: start, then every subscription joins again and catches up before it counts as live. */
  private async reconnect(): Promise<void> {
    if (this.connection.state === HubConnectionState.Disconnected) await this.connection.start();
    const results = await Promise.all([...this.rejoins].map((rejoin) => rejoin()));
    const summary: CatchUp = { count: 0, from: null, to: null };
    for (const r of results) {
      if (!r) continue;
      summary.count += r.count;
      if (r.from !== null) summary.from = Math.min(summary.from ?? r.from, r.from);
      if (r.to !== null) summary.to = Math.max(summary.to ?? r.to, r.to);
    }
    this.caught.next(summary);
  }
}
