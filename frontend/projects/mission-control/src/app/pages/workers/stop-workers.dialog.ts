import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StopWorkersResult, WORKERS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { WorkersStore } from '../../core/workers-store';
import { busyLabel, stopDialogText, unconfirmed } from './workers-text';

/**
 * Stop all workers (L2-029 AC4): one confirmation listing the online workers and what each is running. Hewn answers
 * once every worker halted its run or 10 seconds passed; a worker that didn't confirm is named, and Try again waits
 * for it once more. Cancel closes and changes nothing.
 */
@Component({
  selector: 'hw-stop-workers-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel">
      <h2 class="dialog__title" id="stop-workers-title">Stop all workers?</h2>
      <p class="dialog__text" id="stop-workers-desc">{{ text }}</p>
      @if (failure(); as f) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">{{ f.title }}</p>
            <p class="callout__body">{{ f.body }}</p>
          </div>
        </div>
      }
      @if (online.length > 0) {
        <ul class="tile__body mini-list mt-4" aria-label="Online workers">
          @for (w of online; track w.id) {
            <li>
              @if (w.workingOn) {
                <svg hw-icon name="spinner" class="s-icon--run icon--spin icon--xs"></svg>
              } @else {
                <svg hw-icon name="idleCircle" class="s-icon--idle icon--xs"></svg>
              }
              <span class="truncate mono text-muted" style="flex: 1">{{ w.name }}</span>
              <span class="text-subtle">{{ w.workingOn?.projectName ?? 'Idle' }}</span>
            </li>
          }
        </ul>
      }
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
        @if (stopping()) {
          <button class="btn btn--danger" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>{{ busy }}
          </button>
        } @else {
          <button class="btn btn--danger" type="button" (click)="stop()">
            <svg hw-icon name="octagon"></svg>{{ failure() ? 'Try again' : 'Stop all workers' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class StopWorkersDialog {
  protected readonly ref = inject<DialogRef<StopWorkersResult>>(DialogRef);
  private readonly api = inject(WORKERS_API);
  private readonly store = inject(WorkersStore);

  protected readonly online = (this.store.view()?.workers ?? []).filter((w) => w.online);
  protected readonly text = stopDialogText(this.online);
  protected readonly busy = busyLabel(this.online.length);
  protected readonly stopping = signal(false);
  protected readonly failure = signal<{ title: string; body: string } | null>(null);

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.stopping()) this.ref.close();
  }

  protected stop(): void {
    if (this.stopping()) return;
    this.stopping.set(true);
    this.api.stop().subscribe({
      next: (result) => {
        this.stopping.set(false);
        void this.store.refresh();
        if (result.stopped) {
          this.ref.close(result);
          return;
        }
        this.failure.set(unconfirmed(result.unconfirmed, this.online.length));
      },
      error: () => {
        this.stopping.set(false);
        this.failure.set({
          title: 'Workers weren’t stopped',
          body: 'Hewn couldn’t reach the server. Nothing changed; try again.',
        });
      },
    });
  }
}
