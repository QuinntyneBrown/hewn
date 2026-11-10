import { Injectable, computed, inject, signal } from '@angular/core';
import { WORKERS_API, Workers } from '@hewn/api';
import { firstValueFrom } from 'rxjs';

/**
 * The workers and the leasing switch, for the system banner, the sidebar's Stop all workers / Start workers and the
 * Workers page. The shell refreshes it on every navigation and every few seconds.
 */
@Injectable({ providedIn: 'root' })
export class WorkersStore {
  private readonly api = inject(WORKERS_API);

  readonly view = signal<Workers | null>(null);
  /** Why the last read failed; null once one succeeds. */
  readonly failure = signal<unknown>(null);
  readonly leasing = computed(() => this.view()?.leasing ?? null);
  readonly stopped = computed(() => this.leasing()?.stopped ?? false);

  async refresh(): Promise<void> {
    try {
      this.view.set(await firstValueFrom(this.api.list()));
      this.failure.set(null);
    } catch (error) {
      // Keep what we had; the next refresh tries again.
      this.failure.set(error);
    }
  }
}
