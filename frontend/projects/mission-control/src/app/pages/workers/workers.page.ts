import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Worker } from '@hewn/api';
import { IconComponent } from '@hewn/components';
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

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }
}
