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
   * Crop to the element's whole-pixel box (its position and size rounded down). An element of the same size at a
   * different sub-pixel position then gives an image of the same size, instead of one a pixel larger.
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
  const box = (await locator.boundingBox())!;
  return locator.page().screenshot({
    animations: 'disabled',
    caret: 'hide',
    clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) },
  });
}
