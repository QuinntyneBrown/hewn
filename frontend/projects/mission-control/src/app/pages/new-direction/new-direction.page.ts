import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FieldErrorsProblem, PROJECTS_API } from '@hewn/api';
import {
  describedBy,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FieldComponent,
  IconComponent,
  StatusIconComponent,
} from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { kebab, STAGE_PLAN } from './stage-plan';

/** Server field name → control id on this page. */
const CONTROL_IDS: Record<string, string> = {
  name: 'name',
  idea: 'idea',
  stackPreference: 'stack',
  repositoryUrl: 'repo',
  budgetUsd: 'budget',
};

@Component({
  selector: 'hw-new-direction-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FieldComponent,
    ErrorSummaryComponent,
    IconComponent,
    StatusIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-direction.page.html',
})
export class NewDirectionPage {
  private readonly api = inject(PROJECTS_API);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  protected readonly plan = STAGE_PLAN;
  protected readonly describedBy = describedBy;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: '',
    idea: '',
    stack: '',
    repo: '',
    budget: this.session.config().defaultBudgetUsd.toFixed(2),
  });

  protected readonly submitting = signal(false);
  protected readonly problem = signal<FieldErrorsProblem | null>(null);
  protected readonly failure = signal<string | null>(null);

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly ideaCount = computed(() =>
    (this.values().idea ?? '').length.toLocaleString('en-US'),
  );

  protected readonly repoPlaceholder = computed(() => {
    const owner = this.session.config().githubOwner;
    const slug = kebab(this.values().name ?? '') || 'your-project';
    return owner ? `Creates ${owner}/${slug}` : `Creates a new ${slug} repository`;
  });

  protected readonly budgetHint = computed(
    () =>
      `Pauses at 100%, warns at 80%. Project default is $${this.session.config().defaultBudgetUsd.toLocaleString('en-US')}.`,
  );

  protected readonly summary = computed<ErrorSummaryItem[]>(
    () =>
      this.problem()?.errors.map((e) => ({
        controlId: CONTROL_IDS[e.field] ?? e.field,
        text: e.summary,
      })) ?? [],
  );

  protected error(field: keyof typeof CONTROL_IDS): string | null {
    return this.problem()?.for(field)?.message ?? null;
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.failure.set(null);
    this.api
      .submitProductDirection({
        name: v.name,
        idea: v.idea,
        stackPreference: v.stack.trim() || null,
        repositoryUrl: v.repo.trim() || null,
        budgetUsd: Number.parseFloat(v.budget.replace(/[$,\s]/g, '')) || 0,
      })
      .subscribe({
        next: (result) => {
          this.problem.set(null);
          void this.router.navigate(['/projects', result.projectId]);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (error instanceof FieldErrorsProblem) {
            this.problem.set(error);
            return;
          }
          this.problem.set(null);
          const status = (error as { status?: number }).status;
          this.failure.set(
            `The API returned ${status || 'no response'}. Nothing was created; your text is kept below. Try again.`,
          );
        },
      });
  }
}
