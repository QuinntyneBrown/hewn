import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CancelDirectionResult, PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { cancelFailure, notStopped } from './direction-controls';

export interface CancelDirectionData {
  projectId: string;
  projectName: string;
  directionId: string;
}

/**
 * Cancel (L2-029 AC3): one confirmation. Hewn answers once the worker stopped its run or 10 seconds passed; a
 * worker that didn't answer is named, and Try again checks once more. Keep running closes and changes nothing.
 */
@Component({
  selector: 'hw-cancel-direction-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel">
      <h2 class="dialog__title" id="cancel-title">Cancel {{ data.projectName }}’s direction?</h2>
      <p class="dialog__text" id="cancel-desc">
        The active run stops within 10 seconds and the direction can’t be resumed. Merged work stays
        merged; any open pull request is left open and labelled hewn:cancelled.
      </p>
      @if (failure(); as f) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">{{ f.title }}</p>
            <p class="callout__body">{{ f.body }}</p>
          </div>
        </div>
      }
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Keep running</button>
        @if (cancelling()) {
          <button class="btn btn--danger" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Cancelling…
          </button>
        } @else {
          <button class="btn btn--danger" type="button" (click)="cancel()">
            <svg hw-icon name="stop"></svg>{{ failure() ? 'Try again' : 'Cancel direction' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class CancelDirectionDialog {
  protected readonly data = inject<CancelDirectionData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CancelDirectionResult>>(DialogRef);
  private readonly api = inject(PROJECTS_API);

  protected readonly cancelling = signal(false);
  protected readonly failure = signal<{ title: string; body: string } | null>(null);

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.cancelling()) this.ref.close();
  }

  protected cancel(): void {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.api.cancel(this.data.projectId, this.data.directionId).subscribe({
      next: (result) => {
        this.cancelling.set(false);
        if (result.stopped) {
          this.ref.close(result);
          return;
        }
        this.failure.set({
          title: 'Cancel didn’t reach the worker',
          body: notStopped(result.worker),
        });
      },
      error: (error: unknown) => {
        this.cancelling.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.failure.set({ title: 'The direction wasn’t cancelled', body: cancelFailure(status) });
      },
    });
  }
}
