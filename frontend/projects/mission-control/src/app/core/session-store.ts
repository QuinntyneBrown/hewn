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

  async load(): Promise<void> {
    try {
      this.me.set(await firstValueFrom(this.api.me()));
      this.config.set(await firstValueFrom(this.api.config()));
    } catch {
      this.me.set(null);
    }
  }
}
