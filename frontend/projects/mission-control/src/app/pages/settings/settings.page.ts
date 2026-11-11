import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DirectionDefaults, FieldErrorsProblem, SETTINGS_API } from '@hewn/api';
import {
  describedBy,
  ErrorSummaryComponent,
  ErrorSummaryItem,
  FieldComponent,
  IconComponent,
  IconName,
} from '@hewn/components';
import { SessionStore } from '../../core/session-store';
import { ThemeChoice, ThemeService } from '../../core/theme';
import { dollars } from '../project/pipeline-view';
import { AllowListComponent } from './allow-list';

/** Server field name → control id on this page. */
const CONTROL_IDS: Record<string, string> = {
  defaultBudgetUsd: 'default-budget',
  descopeThresholdDays: 'threshold',
};

/**
 * Settings: the theme, on this device, for anyone signed in (L2-048 AC2), who can sign in (L2-038 AC5), the default budget every new direction starts with (L2-053 AC1) and the
 * descope threshold stage 9 uses (L2-019 AC1). Owners change those; Viewers see them read-only. Integrations arrive
 * with their journey.
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
  protected readonly theme = inject(ThemeService);
  protected readonly themes: { value: ThemeChoice; label: string; hint: string; icon: IconName }[] =
    [
      { value: 'light', label: 'Light', hint: 'Stone canvas, slate ink', icon: 'sun' },
      { value: 'dark', label: 'Dark', hint: 'The Mission Control default at night', icon: 'moon' },
      { value: 'system', label: 'System', hint: 'Follow your operating system', icon: 'monitor' },
    ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    budget: this.session.config().defaultBudgetUsd.toFixed(2),
    threshold: '3',
  });

  /** False until the saved defaults answer (or fail), while the sections show as skeletons. */
  protected readonly loaded = signal(false);
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
        this.loaded.set(true);
      },
      error: () => {
        this.failure.set(
          'The saved defaults didn’t load. The value shown is the configured default.',
        );
        this.loaded.set(true);
      },
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
