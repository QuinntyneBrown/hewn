import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PROJECTS_API } from '@hewn/api';
import { IconComponent } from '@hewn/components';
import { confirmNameError, deleteFailure } from './projects-list';

export interface DeleteProjectData {
  projectId: string;
  projectName: string;
}

/**
 * Delete project (L2-003 AC3): says the GitHub repository is kept, and enables Delete project only when the name is
 * typed exactly. Closes with true once Hewn's records are gone; a refusal or failure says why and offers Try again.
 */
@Component({
  selector: 'hw-delete-project-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel">
      <h2 class="dialog__title" id="delete-title">Delete {{ data.projectName }}?</h2>
      <p class="dialog__text" id="delete-desc">
        Its directions, runs, decisions, events and spend history are deleted from Hewn. This can’t
        be undone.
      </p>
      @if (failure(); as message) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">{{ data.projectName }} wasn’t deleted</p>
            <p class="callout__body">{{ message }}</p>
          </div>
        </div>
      }
      <div class="dialog__body">
        <div class="field">
          <label class="field__label" for="confirm-name"
            >Type <strong>{{ data.projectName }}</strong> to confirm</label
          >
          <div class="field__control">
            <input
              class="input"
              id="confirm-name"
              autocomplete="off"
              [value]="typed()"
              [readOnly]="deleting()"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? 'confirm-name-err' : 'confirm-name-hint'"
              (input)="onInput($event)"
              (blur)="touched.set(true)"
              (keydown.enter)="confirm()"
            />
          </div>
          @if (error(); as message) {
            <span class="field__error" id="confirm-name-err"
              ><svg hw-icon name="errorCircle" class="icon--sm"></svg>{{ message }}</span
            >
          } @else {
            <span class="field__hint" id="confirm-name-hint"
              >The GitHub repository is kept; only Hewn’s record is deleted.</span
            >
          }
        </div>
      </div>
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
        @if (deleting()) {
          <button class="btn btn--danger" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Deleting…
          </button>
        } @else {
          <button class="btn btn--danger" type="button" [disabled]="!matches()" (click)="confirm()">
            <svg hw-icon name="trash"></svg>{{ failure() ? 'Try again' : 'Delete project' }}
          </button>
        }
      </div>
    </div>
  `,
})
export class DeleteProjectDialog {
  protected readonly data = inject<DeleteProjectData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(PROJECTS_API);

  protected readonly typed = signal('');
  protected readonly touched = signal(false);
  protected readonly deleting = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly matches = computed(() => this.typed() === this.data.projectName);
  /** Shown once the field is left with something other than the name, or the API refused the name. */
  protected readonly error = computed(() =>
    this.touched() ? confirmNameError(this.typed(), this.data.projectName) : null,
  );

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.deleting()) this.ref.close();
  }

  protected onInput(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
    if (this.matches()) this.touched.set(false);
  }

  protected confirm(): void {
    if (this.deleting()) return;
    if (!this.matches()) {
      this.touched.set(true);
      return;
    }
    this.deleting.set(true);
    this.api.deleteProject(this.data.projectId, this.typed()).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.deleting.set(false);
        const response = error instanceof HttpErrorResponse ? error : null;
        const title = (response?.error as { title?: unknown } | null)?.title;
        this.failure.set(
          deleteFailure(response?.status ?? 0, typeof title === 'string' ? title : null),
        );
      },
    });
  }
}
