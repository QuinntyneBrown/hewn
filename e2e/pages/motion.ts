import type { Page } from '@playwright/test';

/** What is moving on the page: each running CSS animation or transition and how long one pass of it lasts. */
export class Motion {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Tells the page the user prefers reduced motion, or not (L2-047 AC4). */
  async prefer(reduced: boolean): Promise<void> {
    await this.page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  }

  /** The animations and transitions running now that last longer than `ms`, as "element: name (duration)". */
  async longerThan(ms: number): Promise<string[]> {
    return this.page.evaluate(
      (limit) =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => {
            const effect = a.effect as KeyframeEffect | null;
            const duration = Number(effect?.getComputedTiming().duration ?? 0);
            const target = effect?.target as Element | null;
            const name =
              (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.constructor.name;
            const where = target ? `${target.tagName.toLowerCase()}.${[...target.classList].join('.')}` : '(none)';
            return { text: `${where}: ${name} (${duration} ms)`, duration };
          })
          .filter((a) => a.duration > limit)
          .map((a) => a.text),
      ms,
    );
  }
}
