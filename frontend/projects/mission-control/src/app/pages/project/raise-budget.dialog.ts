import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldErrorsProblem, PROJECTS_API, RaiseAndResumeResult } from '@hewn/api';
import { describedBy, FieldComponent, IconComponent } from '@hewn/components';
import { dollars } from './pipeline-view';
import { parseBudget, raiseBudgetError, raiseFailure } from './raise-budget';

export interface RaiseBudgetData {
  projectId: string;
  projectName: string;
  directionId: string;
  budgetUsd: number;
  spendUsd: number;
  /** The new budget typed into the callout, if any. */
  initial: string;
}

/**
 * Raise and resume (L2-053 AC3): one confirmation that raises a budget-reached direction's budget above the spend
 * so far and resumes it. A budget at or below the spend is refused inline before anything is sent.
 */
@Component({
  selector: 'hw-raise-budget-dialog',
  imports: [FormsModule, FieldComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dialog', '(click)': 'onBackdrop($event)' },
  template: `
    <div class="dialog__panel">
      <h2 class="dialog__title" id="raise-title">Raise {{ data.projectName }}’s budget</h2>
      <p class="dialog__text" id="raise-desc">
        The direction resumes from its last checkpoint as soon as the new budget is saved.
      </p>
      @if (failure(); as message) {
        <div class="callout callout--danger" role="alert">
          <svg hw-icon name="warning" class="icon--lg"></svg>
          <div>
            <p class="callout__title">The budget wasn’t changed</p>
            <p class="callout__body">{{ message }}</p>
          </div>
        </div>
      }
      <form class="dialog__body" novalidate (ngSubmit)="save()">
        <hw-field controlId="new-budget" label="New budget" [hint]="hint" [error]="error()">
          <div class="prefix prefix--money">
            <span class="prefix__sym" aria-hidden="true">$</span
            ><input
              class="input"
              id="new-budget"
              name="budget"
              inputmode="decimal"
              [ngModel]="budget()"
              (ngModelChange)="budget.set($event)"
              [readOnly]="saving()"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="describedBy('new-budget', error())"
            />
          </div>
        </hw-field>
        <button type="submit" hidden></button>
      </form>
      <div class="dialog__footer">
        <button class="btn btn--ghost" type="button" (click)="ref.close()">Cancel</button>
        @if (saving()) {
          <button class="btn btn--primary" type="button" aria-busy="true" disabled>
            <svg hw-icon name="spinner"></svg>Saving…
          </button>
        } @else {
          <button class="btn btn--primary" type="button" (click)="save()">
            <svg hw-icon name="play"></svg>Raise and resume
          </button>
        }
      </div>
    </div>
  `,
})
export class RaiseBudgetDialog {
  protected readonly data = inject<RaiseBudgetData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<RaiseAndResumeResult>>(DialogRef);
  private readonly api = inject(PROJECTS_API);

  protected readonly budget = signal(this.data.initial);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);
  /** Shown once the Owner tries to save, or when the API refused the amount. */
  private readonly attempted = signal(false);
  private readonly serverError = signal<string | null>(null);
  protected readonly error = computed(
    () =>
      this.serverError() ??
      (this.attempted() ? raiseBudgetError(this.budget(), this.data.spendUsd) : null),
  );
  protected readonly hint = `Warns again at 80%. ${dollars(this.data.spendUsd)} spent so far.`;
  protected readonly describedBy = describedBy;

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.saving()) this.ref.close();
  }

  protected save(): void {
    if (this.saving()) return;
    this.attempted.set(true);
    this.serverError.set(null);
    if (raiseBudgetError(this.budget(), this.data.spendUsd)) return;
    this.saving.set(true);
    this.failure.set(null);
    this.api
      .raiseAndResume(this.data.projectId, this.data.directionId, {
        budgetUsd: parseBudget(this.budget())!,
        currentBudgetUsd: this.data.budgetUsd,
      })
      .subscribe({
        next: (result) => this.ref.close(result),
        error: (error: unknown) => {
          this.saving.set(false);
          if (error instanceof FieldErrorsProblem) {
            this.serverError.set(
              error.for('budgetUsd')?.message ?? error.errors[0]?.message ?? null,
            );
            return;
          }
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          const code =
            error instanceof HttpErrorResponse
              ? ((error.error as { code?: string } | null)?.code ?? null)
              : null;
          this.failure.set(raiseFailure(status, code));
        },
      });
  }
}
