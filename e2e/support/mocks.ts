import { Locator, Page } from '@playwright/test';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const mocksRoot = path.resolve(import.meta.dirname, '../../docs/mocks');

/** URL of a mock page with its mock chrome hidden. */
export function mockUrl(relative: string): string {
  return `file://${path.join(mocksRoot, relative)}?chrome=0`;
}

export interface Difference {
  ratio: number;
  width: number;
  height: number;
}

/** Compares two PNG screenshots pixel by pixel. Sizes must match. */
export function compare(actual: Buffer, expected: Buffer): Difference {
  const a = PNG.sync.read(actual);
  const e = PNG.sync.read(expected);
  if (a.width !== e.width || a.height !== e.height) {
    throw new Error(`Size differs: app ${a.width}x${a.height}, mock ${e.width}x${e.height}`);
  }
  const changed = pixelmatch(a.data, e.data, null, a.width, a.height, { threshold: 0.1 });
  return { ratio: changed / (a.width * a.height), width: a.width, height: a.height };
}

export interface RegionOptions {
  /**
   * Move the element onto the whole-pixel grid, then crop to its box with the size rounded down. An element of the
   * same size at a different sub-pixel position, for example below a header of another height, then gives the same
   * image: the same size, and its text rasterised on the same grid.
   */
  snap?: boolean;
}

/** Screenshots a region of a mock, in the same viewport as the app page. */
export async function mockRegion(
  page: Page,
  mock: string,
  selector: string,
  options: RegionOptions = {},
): Promise<Buffer> {
  const mockPage = await page.context().newPage();
  await mockPage.setViewportSize(page.viewportSize()!);
  await mockPage.goto(mockUrl(mock));
  const shot = await region(mockPage.locator(selector).first(), options);
  await mockPage.close();
  return shot;
}

export async function region(locator: Locator, options: RegionOptions = {}): Promise<Buffer> {
  if (!options.snap) return locator.screenshot({ animations: 'disabled', caret: 'hide' });
  const page = locator.page();
  await locator.scrollIntoViewIfNeeded();
  // Move the element by its sub-pixel offset so it starts on a whole pixel, as the same element does in the mock.
  // A relative offset goes through layout, which snaps borders and text to the pixel grid as a static element's
  // are; a transform would raster the element on its own layer at the fractional position.
  const restore = await locator.evaluate((el: HTMLElement) => {
    const before = el.getAttribute('style');
    const r = el.getBoundingClientRect();
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.left = `${Math.round(r.x) - r.x}px`;
    el.style.top = `${Math.round(r.y) - r.y}px`;
    return before;
  });
  const box = (await locator.boundingBox())!;
  // The box is relative to the viewport; a full-page clip in page coordinates also covers a region below the fold.
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const shot = await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    clip: {
      x: Math.round(box.x + scroll.x),
      y: Math.round(box.y + scroll.y),
      width: Math.floor(box.width),
      height: Math.floor(box.height),
    },
  });
  await locator.evaluate((el: HTMLElement, before: string | null) => {
    if (before === null) el.removeAttribute('style');
    else el.setAttribute('style', before);
  }, restore);
  return shot;
}
