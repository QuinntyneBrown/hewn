import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FieldErrorsProblem, SETTINGS_API } from '@hewn/api';
import {
  describedBy,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FieldComponent,
  IconComponent,
} from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { dollars } from '../project/pipeline-view';

/** Server field name → control id on this page. */
const CONTROL_IDS: Record<string, string> = { defaultBudgetUsd: 'default-budget' };

/**
 * Settings (L2-053 AC1): the default budget every new direction starts with. Owners save it; Viewers see it
 * read-only. Appearance, sign-in access, the descope threshold and integrations arrive with their journeys.
 */
@Component({
  selector: 'hw-settings-page',
  imports: [ReactiveFormsModule, FieldComponent, ErrorSummaryComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  private readonly api = inject(SETTINGS_API);
  protected readonly session = inject(SessionStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    budget: this.session.config().defaultBudgetUsd.toFixed(2),
  });

  protected readonly saving = signal(false);
  protected readonly problem = signal<FieldErrorsProblem | null>(null);
  protected readonly failure = signal<string | null>(null);
  /** The budget just saved, for the "Defaults saved" callout. */
  protected readonly saved = signal<number | null>(null);
  protected readonly readOnly = computed(() => !this.session.isOwner() || this.saving());
  protected readonly describedBy = describedBy;

  protected readonly summary = computed<ErrorSummaryItem[]>(
    () =>
      this.problem()?.errors.map((e) => ({
        controlId: CONTROL_IDS[e.field] ?? e.field,
        text: e.summary,
      })) ?? [],
  );

  constructor() {
    this.api.getDirectionDefaults().subscribe({
      next: (defaults) => {
        if (!this.form.dirty)
          this.form.controls.budget.setValue(defaults.defaultBudgetUsd.toFixed(2));
      },
      error: () =>
        this.failure.set(
          'The saved defaults didn’t load. The value shown is the configured default.',
        ),
    });
  }

  protected error(field: string): string | null {
    return this.problem()?.for(field)?.message ?? null;
  }

  protected savedText(budget: number): string {
    return `New directions start with a ${dollars(budget)} budget. Directions already running keep theirs.`;
  }

  protected save(): void {
    if (this.readOnly()) return;
    const text = this.form.getRawValue().budget.replace(/[$,\s]/g, '');
    const defaultBudgetUsd = text === '' ? 0 : Number(text);
    this.saving.set(true);
    this.saved.set(null);
    this.failure.set(null);
    this.api
      .saveDirectionDefaults({
        defaultBudgetUsd: Number.isFinite(defaultBudgetUsd) ? defaultBudgetUsd : 0,
      })
      .subscribe({
        next: (defaults) => {
          this.saving.set(false);
          this.problem.set(null);
          this.saved.set(defaults.defaultBudgetUsd);
          this.form.controls.budget.setValue(defaults.defaultBudgetUsd.toFixed(2));
          this.form.markAsPristine();
          this.session.config.update((c) => ({
            ...c,
            defaultBudgetUsd: defaults.defaultBudgetUsd,
          }));
        },
        error: (error: unknown) => {
          this.saving.set(false);
          if (error instanceof FieldErrorsProblem) {
            this.problem.set(error);
            return;
          }
          this.problem.set(null);
          const status = (error as { status?: number }).status;
          this.failure.set(
            status === 403
              ? 'Only an Owner can change the defaults.'
              : `The API returned ${status || 'no response'}. Nothing was saved. Try again.`,
          );
        },
      });
  }
}
