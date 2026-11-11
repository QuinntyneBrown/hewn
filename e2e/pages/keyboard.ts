import type { Locator, Page } from '@playwright/test';

/** One place Tab stopped: what it was, and whether it showed a focus indicator there. */
export interface TabStop {
  name: string;
  ring: boolean;
  visible: boolean;
}

/** What tabbing through a whole page found: every stop, and whether focus came back round to the start. */
export interface TabWalk {
  stops: TabStop[];
  wrapped: boolean;
}

/**
 * Keyboard-only use of Mission Control (L2-047 AC2): Tab, Shift+Tab, Enter, Space and Escape, with a check that
 * each stop shows the design system's focus indicator: an outline, or the focus-ring inset shadow fields and menu
 * items use.
 */
export class Keyboard {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** The focused element, described, with whether its focus indicator shows. */
  async focused(): Promise<TabStop & { atStart: boolean }> {
    const stop = await this.page.evaluate(describeFocus, false);
    return { name: stop.name, ring: stop.ring, visible: stop.visible, atStart: stop.seen === 'start' };
  }

  /**
   * Tabs from the top of the page until focus leaves the page or comes back to the first stop. A page that holds
   * focus in a loop of its own (a keyboard trap) lands on a stop it has seen before, other than the first.
   */
  async walk(limit = 5000): Promise<TabWalk> {
    await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const stops: TabStop[] = [];
    for (let i = 0; i < limit; i++) {
      await this.page.keyboard.press('Tab');
      const stop = await this.page.evaluate(describeFocus, true);
      if (stop.seen === 'start') return { stops, wrapped: true };
      if (stop.seen === 'again') return { stops, wrapped: false };
      stops.push({ name: stop.name, ring: stop.ring, visible: stop.visible });
    }
    return { stops, wrapped: false };
  }

  /** Presses Tab until `target` has focus, as a keyboard user would reach it. */
  async tabTo(target: Locator, limit = 80): Promise<void> {
    for (let i = 0; i < limit; i++) {
      if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
      await this.page.keyboard.press('Tab');
    }
    throw new Error(`Tab never reached ${target.toString()} in ${limit} presses`);
  }

  /** Presses a key: Enter, Space, Escape, ArrowDown, a letter. */
  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /** Types text into whatever has focus. */
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /** Whether `target` has focus now. */
  async isFocused(target: Locator): Promise<boolean> {
    return target.evaluate((el) => el === document.activeElement);
  }
}

/**
 * Runs in the page: the focused element and its focus indicator, read once its transitions finish (fields ease their
 * ring in). With `mark`, it also numbers each element it lands on, to tell coming round from a loop.
 */
async function describeFocus(mark: boolean): Promise<TabStop & { seen: 'new' | 'start' | 'again' }> {
  const el = document.activeElement as (HTMLElement & { __tabStop?: number }) | null;
  if (!el || el === document.body || el === document.documentElement) {
    return { name: '(page)', ring: false, visible: false, seen: 'start' };
  }
  let seen: 'new' | 'start' | 'again' = 'new';
  if (mark) {
    const w = window as unknown as { __tabStops?: number };
    if (el.__tabStop === undefined) el.__tabStop = w.__tabStops = (w.__tabStops ?? 0) + 1;
    else seen = el.__tabStop === 1 ? 'start' : 'again';
  }
  if (seen !== 'new') return { name: '', ring: false, visible: false, seen };
  const running = el.getAnimations();
  if (running.length) await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
  const probe = document.createElement('span');
  probe.style.color = 'var(--color-focus-ring)';
  document.body.append(probe);
  const ringColour = getComputedStyle(probe).color;
  probe.remove();
  const style = getComputedStyle(el);
  const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1;
  const box = el.getBoundingClientRect();
  const label = el.getAttribute('aria-label') || (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return {
    name: `${el.tagName.toLowerCase()} "${label || el.getAttribute('placeholder') || el.getAttribute('name') || el.id}"`,
    ring: outline || style.boxShadow.includes(ringColour),
    visible: box.width > 0 && box.height > 0,
    seen,
  };
}
