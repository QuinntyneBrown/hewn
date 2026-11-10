import type { Locator, Page } from '@playwright/test';

/** One step of the increment's timeline. */
export interface TimelineStep {
  root: Locator;
  title: Locator;
  time: Locator;
  detail: Locator;
}

/** One required check in the pull request rail. */
export interface CheckItem {
  root: Locator;
  name: Locator;
  detail: Locator;
}

/** An increment followed to merge (/projects/{id}/increments/{n}). Owns every selector for it. */
export class IncrementPage {
  readonly heading: Locator;
  readonly breadcrumb: Locator;
  readonly status: Locator;
  readonly meta: Locator;
  readonly timeline: Locator;
  readonly steps: Locator;
  readonly rail: Locator;
  readonly pullRequest: Locator;
  readonly checks: Locator;
  readonly body: Locator;
  readonly failingTests: Locator;
  readonly railNote: Locator;
  readonly failure: Locator;
  readonly tryAgain: Locator;
  readonly backToBacklog: Locator;
  readonly loading: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.status = page.locator('.cluster--lg .status');
    this.meta = page.locator('.phead__meta');
    this.timeline = page.locator('.timeline');
    this.steps = this.timeline.locator('.timeline__item');
    this.rail = page.getByRole('complementary', { name: 'Pull request' });
    this.pullRequest = this.rail.locator('.card--link');
    this.checks = this.rail.locator('.checks li');
    this.body = this.rail.locator('dl.kv');
    this.failingTests = this.rail.locator('pre');
    this.railNote = this.rail.locator('p.text-muted');
    this.failure = page.getByRole('alert').filter({ hasText: 'This increment couldn’t load' });
    this.tryAgain = this.failure.getByRole('button', { name: 'Try again' });
    this.backToBacklog = page.getByRole('link', { name: 'Back to backlog' });
    this.loading = page.getByText(/^Loading increment \d+$/);
  }

  async open(projectId: string, number: number): Promise<void> {
    await this.page.goto(`/projects/${projectId}/increments/${number}`);
  }

  /** The timeline step whose title starts with `title`. */
  step(title: string | RegExp): TimelineStep {
    const root = this.steps.filter({
      has: this.page.locator('.timeline__t', { hasText: typeof title === 'string' ? new RegExp(`^${title}`) : title }),
    });
    return {
      root,
      title: root.locator('.timeline__t'),
      time: root.locator('.timeline__time'),
      detail: root.locator('.timeline__d'),
    };
  }

  /** The visible titles of every timeline step, without their read-out status. */
  async stepTitles(): Promise<string[]> {
    return this.steps
      .locator('.timeline__t')
      .evaluateAll((els) => els.map((el) => (el.firstChild?.textContent ?? '').trim()));
  }

  check(name: string): CheckItem {
    const root = this.checks.filter({ has: this.page.locator('.checks__name', { hasText: name }) });
    return { root, name: root.locator('.checks__name'), detail: root.locator('.checks__d') };
  }

  /** A body section's text by its heading: What, Design and decisions, API, Tests, Deferred, Notes or Attribution. */
  section(heading: string): Locator {
    return this.body
      .locator('div')
      .filter({ has: this.page.locator('dt', { hasText: heading }) })
      .locator('dd');
  }
}
