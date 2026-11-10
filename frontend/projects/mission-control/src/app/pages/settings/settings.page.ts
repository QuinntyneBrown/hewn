import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DirectionDefaults, FieldErrorsProblem, SETTINGS_API } from '@hewn/api';
import {
  describedBy,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FieldComponent,
  IconComponent,
} from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { dollars } from '../project/pipeline-view';
import { AllowListComponent } from './allow-list';

/** Server field name → control id on this page. */
const CONTROL_IDS: Record<string, string> = {
  defaultBudgetUsd: 'default-budget',
  descopeThresholdDays: 'threshold',
};

/**
 * Settings: who can sign in (L2-038 AC5), the default budget every new direction starts with (L2-053 AC1) and the
 * descope threshold stage 9 uses (L2-019 AC1). Owners change them; Viewers see them read-only. Appearance and
 * integrations arrive with their journeys.
 */
@Component({
  selector: 'hw-settings-page',
  imports: [
    ReactiveFormsModule,
    FieldComponent,
    ErrorSummaryComponent,
    IconComponent,
    AllowListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  private readonly api = inject(SETTINGS_API);
  protected readonly session = inject(SessionStore);

  protected readonly form = inject(NonNullableFormBuilder).group({
    budget: this.session.config().defaultBudgetUsd.toFixed(2),
    threshold: '3',
  });

  protected readonly saving = signal(false);
  protected readonly problem = signal<FieldErrorsProblem | null>(null);
  protected readonly failure = signal<string | null>(null);
  /** The defaults just saved, for the "Defaults saved" callout. */
  protected readonly saved = signal<DirectionDefaults | null>(null);
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
        if (!this.form.dirty) this.show(defaults);
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

  protected savedText(saved: DirectionDefaults): string {
    return (
      `New directions start with a ${dollars(saved.defaultBudgetUsd)} budget and a ` +
      `${saved.descopeThresholdDays}-day descope threshold. Directions already running keep theirs.`
    );
  }

  private show(defaults: DirectionDefaults): void {
    this.form.setValue({
      budget: defaults.defaultBudgetUsd.toFixed(2),
      threshold: String(defaults.descopeThresholdDays),
    });
  }

  /** The server validates; text that isn't a number is sent as 0, so it gets the same field error. */
  private static number(text: string): number {
    const value = text === '' ? 0 : Number(text);
    return Number.isFinite(value) ? value : 0;
  }

  protected save(): void {
    if (this.readOnly()) return;
    const { budget, threshold } = this.form.getRawValue();
    this.saving.set(true);
    this.saved.set(null);
    this.failure.set(null);
    this.api
      .saveDirectionDefaults({
        defaultBudgetUsd: SettingsPage.number(budget.replace(/[$,\s]/g, '')),
        descopeThresholdDays: SettingsPage.number(threshold.trim()),
      })
      .subscribe({
        next: (defaults) => {
          this.saving.set(false);
          this.problem.set(null);
          this.saved.set(defaults);
          this.show(defaults);
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
