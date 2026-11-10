import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { WORKERS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { notRevoked } from './workers-text';

/**
 * Revoke a worker (L2-041 AC2): its token stops working at once, it disconnects within 10 seconds and any run it holds
 * resumes elsewhere from its last checkpoint. When the API doesn't confirm, the token is still active and the dialog
 * says so; Try again sends it once more.
 */
@Component({
  selector: 'hw-revoke-worker-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel">
      <h2 class="dialog__title" id="revoke-worker-title">Revoke {{ worker.name }}?</h2>
      <p class="dialog__text" id="revoke-worker-desc">
        Its token stops working immediately. If it is running a step, the lease is released and the
        run resumes on another worker from its last checkpoint.
      </p>
      @if (failure(); as f) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">The token is still active</p>
            <p class="callout__body">{{ f }}</p>
          </div>
        </div>
      }
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
        @if (revoking()) {
          <button class="btn btn--danger" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Revoking…
          </button>
        } @else {
          <button class="btn btn--danger" type="button" (click)="revoke()">
            <svg hw-icon name="xCircle"></svg>{{ failure() ? 'Try again' : 'Revoke token' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class RevokeWorkerDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly worker = inject<{ id: string; name: string }>(DIALOG_DATA);
  private readonly api = inject(WORKERS_API);

  protected readonly revoking = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.revoking()) this.ref.close();
  }

  protected revoke(): void {
    if (this.revoking()) return;
    this.revoking.set(true);
    this.failure.set(null);
    this.api.revoke(this.worker.id).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.revoking.set(false);
        this.failure.set(notRevoked(this.worker.name, error));
      },
    });
  }
}
