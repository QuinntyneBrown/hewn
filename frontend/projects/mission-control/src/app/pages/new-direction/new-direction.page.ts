import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { FEATURE_PLAN, kebab, productLabel, STAGE_PLAN } from './stage-plan';

export type DirectionMode = 'product' | 'feature';

/** Server field name → control id on this page, for each direction type. */
const CONTROL_IDS: Record<DirectionMode, Record<string, string>> = {
  product: {
    name: 'name',
    idea: 'idea',
    stackPreference: 'stack',
    repositoryUrl: 'repo',
    budgetUsd: 'budget',
  },
  feature: { idea: 'feature', budgetUsd: 'budget' },
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

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly plan = STAGE_PLAN;
  protected readonly featurePlan = FEATURE_PLAN;

  /** New product, or Feature for a product (L2-005); `?kind=feature&project={id}` opens the second. */
  protected readonly mode = signal<DirectionMode>(
    this.query.get('kind') === 'feature' ? 'feature' : 'product',
  );

  /** Products a feature can be added to, labelled with their repository or that the feature would queue. */
  protected readonly products = toSignal(
    this.api
      .listProjects()
      .pipe(map((list) => list.map((p) => ({ id: p.id, label: productLabel(p) })))),
    { initialValue: null },
  );
  protected readonly describedBy = describedBy;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: '',
    idea: '',
    stack: '',
    repo: '',
    budget: this.session.config().defaultBudgetUsd.toFixed(2),
    product: this.query.get('project') ?? '',
    feature: '',
  });

  /** Selects the first product once the list arrives, unless one was chosen or named in the URL. */
  private readonly defaultProduct = effect(() => {
    const first = this.products()?.[0];
    if (first && !this.form.controls.product.value) this.form.controls.product.setValue(first.id);
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

  protected readonly featureCount = computed(() =>
    (this.values().feature ?? '').length.toLocaleString('en-US'),
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
        controlId: CONTROL_IDS[this.mode()][e.field] ?? e.field,
        text: e.summary,
      })) ?? [],
  );

  protected error(field: string): string | null {
    return this.problem()?.for(field)?.message ?? null;
  }

  protected choose(mode: DirectionMode): void {
    if (this.submitting() || this.mode() === mode) return;
    this.mode.set(mode);
    this.problem.set(null);
    this.failure.set(null);
    if (mode === 'feature' && !this.form.controls.product.value) {
      const first = this.products()?.[0];
      if (first) this.form.controls.product.setValue(first.id);
    }
  }

  /** Arrow keys move between the two direction types, as in any radio group. */
  protected onModeKey(event: KeyboardEvent): void {
    const keys: Record<string, DirectionMode> = {
      ArrowRight: 'feature',
      ArrowDown: 'feature',
      ArrowLeft: 'product',
      ArrowUp: 'product',
    };
    const mode = keys[event.key];
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.choose((event.target as HTMLElement).dataset['mode'] as DirectionMode);
      return;
    }
    if (!mode) return;
    event.preventDefault();
    this.choose(mode);
    const group = (event.target as HTMLElement).parentElement;
    group?.querySelector<HTMLElement>(`[data-mode="${mode}"]`)?.focus();
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    const v = this.form.getRawValue();
    const budgetUsd = Number.parseFloat(v.budget.replace(/[$,\s]/g, '')) || 0;
    if (this.mode() === 'feature' && !v.product) {
      this.failure.set(
        'Choose the product to add this feature to. Start a new product first if there is none.',
      );
      return;
    }
    this.submitting.set(true);
    this.failure.set(null);
    const request =
      this.mode() === 'feature'
        ? this.api.submitFeatureDirection(v.product, { idea: v.feature, budgetUsd })
        : this.api.submitProductDirection({
            name: v.name,
            idea: v.idea,
            stackPreference: v.stack.trim() || null,
            repositoryUrl: v.repo.trim() || null,
            budgetUsd,
          });
    request.subscribe({
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
