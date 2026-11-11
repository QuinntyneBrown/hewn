import type { Page } from '@playwright/test';

export type Scheme = 'light' | 'dark';

/** The colour scheme Mission Control is showing, and the operating system's preference the page sees (L2-048). */
export class Theme {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Tells the page the operating system now prefers `scheme`, as switching the OS setting would. */
  async osPrefers(scheme: Scheme): Promise<void> {
    await this.page.emulateMedia({ colorScheme: scheme });
  }

  /** Waits for the colours that ease from one theme to the other (links, buttons) to finish; spinners never do. */
  async settle(): Promise<void> {
    await this.page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
  }

  /** The scheme the page is drawn in: the `color-scheme` its tokens set on the root. */
  async shown(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  }

  /** The page's background colour, as the tokens resolve it. */
  async background(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  }
}
