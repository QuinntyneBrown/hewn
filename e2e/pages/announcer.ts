import type { Locator, Page } from '@playwright/test';

/** The shell's polite live region, where stage changes are said (L2-047 AC3), and a record of what it said. */
export class Announcer {
  readonly region: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.region = page.locator('[data-testid="status-announcer"]');
  }

  /** Starts recording each text the region takes, with when. */
  async record(): Promise<void> {
    await this.region.evaluate((region) => {
      const log: { at: number; text: string }[] = [];
      (window as unknown as { __said: typeof log }).__said = log;
      new MutationObserver(() => log.push({ at: performance.now(), text: region.textContent?.trim() ?? '' })).observe(
        region,
        { childList: true, characterData: true, subtree: true },
      );
    });
  }

  /** What the region has said since `record()`, oldest first. */
  async said(): Promise<{ at: number; text: string }[]> {
    return this.page.evaluate(() => (window as unknown as { __said?: { at: number; text: string }[] }).__said ?? []);
  }
}
