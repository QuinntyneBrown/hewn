import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { CreatedWorkerToken, Worker } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { Toasts } from '../../core/toasts';
import { WorkersStore } from '../../core/workers-store';
import { connectedFor, seenAgo, workerActivity, workerStatus } from './workers-text';

/** Every registered worker: where it runs, its status, what it is working on and its last heartbeat. */
@Component({
  selector: 'hw-workers-page',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workers.page.html',
})
export class WorkersPage implements OnDestroy {
  protected readonly store = inject(WorkersStore);
  protected readonly session = inject(SessionStore);
  private readonly dialog = inject(Dialog);
  private readonly toasts = inject(Toasts);
  private readonly now = signal(Date.now());
  private readonly tick = setInterval(() => this.now.set(Date.now()), 1_000);

  protected readonly rows = computed(() =>
    [...(this.store.view()?.workers ?? [])]
      // Online workers first, then by host name.
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
      .map((w: Worker) => ({
        ...w,
        shortId: `wk-${w.id.slice(-4)}`,
        state: workerStatus(w.status),
        activity: workerActivity(w),
        seen: seenAgo(w.lastSeenAt, this.now()),
        connected: w.online ? connectedFor(w.registeredAt, this.now()) : '—',
      })),
  );

  constructor() {
    void this.store.refresh();
  }

  protected openNewToken(): void {
    // Loaded on demand, so the dialog stays out of the Workers chunk.
    void import('./worker-token.dialog').then((m) => {
      const ref = this.dialog.open<CreatedWorkerToken>(m.WorkerTokenDialog, {
        ariaLabelledBy: 'worker-token-title',
        ariaDescribedBy: 'worker-token-desc',
        backdropClass: 'backdrop',
        autoFocus: '#worker-name',
        // Escape would lose a token shown once; only Done closes it then.
        disableClose: true,
      });
      ref.closed.subscribe(() => void this.store.refresh());
    });
  }

  protected openRevoke(worker: { id: string; name: string }): void {
    void import('./revoke-worker.dialog').then((m) => {
      const ref = this.dialog.open<boolean>(m.RevokeWorkerDialog, {
        role: 'alertdialog',
        data: { id: worker.id, name: worker.name },
        ariaLabelledBy: 'revoke-worker-title',
        ariaDescribedBy: 'revoke-worker-desc',
        backdropClass: 'backdrop',
        autoFocus: 'first-tabbable',
      });
      ref.closed.subscribe((revoked) => {
        if (!revoked) return;
        this.toasts.show({
          tone: 'ok',
          title: `${worker.name} revoked`,
          text: 'Its token no longer works; it disconnects within 10 seconds.',
        });
        void this.store.refresh();
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }
}
