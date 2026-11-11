import type { Locator, Page } from '@playwright/test';

/** The shell's navigation: the fixed sidebar from 992 px, and the top bar's menu drawer below it (L2-046). */
export class Navigation {
  readonly sidebar: Locator;
  readonly menuButton: Locator;
  readonly drawer: Locator;
  readonly closeMenu: Locator;
  readonly heading: Locator;
  readonly topbar: Locator;
  readonly drawerNav: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    this.menuButton = page.getByRole('button', { name: 'Open menu' });
    this.drawer = page.getByRole('dialog', { name: 'Menu' });
    this.closeMenu = this.drawer.getByRole('button', { name: 'Close menu' });
    this.topbar = page.getByRole('banner');
    this.drawerNav = this.drawer.getByRole('navigation', { name: 'Primary, menu' });
  }

  /** A link in the drawer's primary navigation. */
  drawerLink(name: string): Locator {
    return this.drawerNav.getByRole('link', { name });
  }

  /** Opens a page and waits until it has loaded its data. */
  async visit(path: string): Promise<void> {
    await this.page.goto(path);
    await this.heading.first().waitFor();
    await this.page.waitForLoadState('networkidle');
  }

  /** Opens the drawer and waits for it to finish sliding in. */
  async openMenu(): Promise<void> {
    await this.menuButton.click();
    await this.drawer.waitFor();
    await this.page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  }

  async width(width: number): Promise<void> {
    await this.page.setViewportSize({ width, height: 900 });
  }

  /** How far the page scrolls sideways: 0 when nothing is wider than the viewport. */
  horizontalScroll(): Promise<number> {
    return this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }

  /**
   * The visible controls smaller than the given size, as "name (w×h)". Controls are buttons, links styled as
   * buttons, navigation links, tabs and form fields; a link inside running text sizes with its line (WCAG 2.5.8's
   * inline exception).
   */
  smallTargets(min: number): Promise<string[]> {
    return this.page.evaluate((min) => {
      const controls = document.querySelectorAll<HTMLElement>(
        'button, .btn, .nav-link, .side-project, [role="tab"], .tab, input:not([type="hidden"]), select, textarea, .icon-action, .state-link, .req-link, .pagination__page',
      );
      const small: string[] = [];
      for (const el of controls) {
        if (el.closest('[inert], [aria-hidden="true"], .visually-hidden')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // A checkbox or radio is one target with its label.
        const target = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest('label') ?? el) : el;
        const t = target.getBoundingClientRect();
        if (t.width < min - 0.5 || t.height < min - 0.5) {
          const name = (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().replace(/\s+/g, ' ');
          small.push(`${name.slice(0, 40)} (${Math.round(t.width)}×${Math.round(t.height)})`);
        }
      }
      return small;
    }, min);
  }
}
