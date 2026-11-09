import { Injectable, computed, inject, signal } from '@angular/core';
import { Me, PublicConfig, SESSION_API } from '@hewn/api';
import { firstValueFrom } from 'rxjs';

/** The signed-in user, loaded once at start-up. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly api = inject(SESSION_API);

  readonly me = signal<Me | null>(null);
  readonly config = signal<PublicConfig>({ githubOwner: null, defaultBudgetUsd: 300 });
  readonly isOwner = computed(() => this.me()?.role === 'Owner');
  readonly signedIn = computed(() => this.me() !== null);

  /** Loads the user and the public config together, so start-up waits for one round trip, not two (L2-045 AC1). */
  async load(): Promise<void> {
    const [me, config] = await Promise.allSettled([
      firstValueFrom(this.api.me()),
      firstValueFrom(this.api.config()),
    ]);
    this.me.set(me.status === 'fulfilled' ? me.value : null);
    if (me.status === 'fulfilled' && config.status === 'fulfilled') this.config.set(config.value);
  }
}
