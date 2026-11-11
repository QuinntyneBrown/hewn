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
    return this.page.evaluate(async () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) {
        return { name: '(page)', ring: false, visible: false, atStart: true };
      }
      // Fields ease their ring in; read it once the transition has finished.
      await Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined)));
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-focus-ring)';
      document.body.append(probe);
      const ringColour = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1;
      const shadow = style.boxShadow.includes(ringColour);
      const box = el.getBoundingClientRect();
      const label =
        el.getAttribute('aria-label') ??
        (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) ??
        el.getAttribute('placeholder');
      return {
        name: `${el.tagName.toLowerCase()} "${label || el.getAttribute('name') || el.id}"`,
        ring: outline || shadow,
        visible: box.width > 0 && box.height > 0,
        atStart: false,
      };
    });
  }

  /**
   * Tabs from the top of the page until focus leaves the page or comes back to the first stop. A page that holds
   * focus in a loop of its own (a keyboard trap) never wraps.
   */
  async walk(limit = 3000): Promise<TabWalk> {
    await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const stops: TabStop[] = [];
    for (let i = 0; i < limit; i++) {
      await this.page.keyboard.press('Tab');
      // 0: a stop not seen yet; 1: the first stop again (focus came round); 2: another stop again (a loop).
      const seen = await this.page.evaluate(() => {
        const el = document.activeElement as (HTMLElement & { __tabStop?: number }) | null;
        if (!el || el === document.body) return 1;
        if (el.__tabStop === undefined) {
          el.__tabStop = (window as unknown as { __tabStops: number }).__tabStops =
            ((window as unknown as { __tabStops?: number }).__tabStops ?? 0) + 1;
          return 0;
        }
        return el.__tabStop === 1 ? 1 : 2;
      });
      if (seen === 1) return { stops, wrapped: true };
      if (seen === 2) return { stops, wrapped: false };
      const stop = await this.focused();
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
