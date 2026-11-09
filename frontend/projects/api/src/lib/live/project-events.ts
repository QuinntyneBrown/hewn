import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { firstValueFrom, Observable } from 'rxjs';
import { ProjectEvent } from './project-event';

/**
 * Live project events. The client owns the hub connection, reconnects, and catch-up by sequence number:
 * subscribers receive every event after `afterSequence` exactly once, in order. Components never open a hub.
 */
export interface ProjectEvents {
  follow(projectId: string, afterSequence: number): Observable<ProjectEvent>;
}

export const PROJECT_EVENTS = new InjectionToken<ProjectEvents>('ProjectEvents');

@Injectable()
export class SignalRProjectEvents implements ProjectEvents, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly connection: HubConnection = new HubConnectionBuilder()
    .withUrl('/hubs/mission-control')
    .withAutomaticReconnect([0, 1_000, 2_000, 5_000, 10_000, 15_000])
    .configureLogging(LogLevel.Warning)
    .build();
  private starting: Promise<void> | null = null;

  follow(projectId: string, afterSequence: number): Observable<ProjectEvent> {
    return new Observable<ProjectEvent>((subscriber) => {
      let last = afterSequence;
      let closed = false;
      // Live events that arrive while a catch-up request is in flight wait here, then drain in order.
      let catchingUp = true;
      const buffered: ProjectEvent[] = [];

      const emit = (event: ProjectEvent) => {
        if (event.sequence <= last) return;
        last = event.sequence;
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

      // SignalR has no way to remove an onreconnected callback, so a closed subscription ignores it.
      const onReconnected = () => {
        if (!closed) void catchUp().catch((error: unknown) => subscriber.error(error));
      };

      this.connection.on('ProjectEvent', onEvent);
      this.connection.onreconnected(onReconnected);
      this.ensureStarted()
        .then(() => (closed ? undefined : catchUp()))
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        closed = true;
        this.connection.off('ProjectEvent', onEvent);
        if (this.connection.state === HubConnectionState.Connected) {
          void this.connection.invoke('LeaveProject', projectId).catch(() => undefined);
        }
      };
    });
  }

  ngOnDestroy(): void {
    void this.connection.stop();
  }

  private ensureStarted(): Promise<void> {
    if (this.connection.state === HubConnectionState.Connected) return Promise.resolve();
    this.starting ??= this.connection.start().finally(() => (this.starting = null));
    return this.starting;
  }
}
