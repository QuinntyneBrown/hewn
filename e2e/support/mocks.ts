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

/** Screenshots a region of a mock, in the same viewport as the app page. */
export async function mockRegion(page: Page, mock: string, selector: string): Promise<Buffer> {
  const mockPage = await page.context().newPage();
  await mockPage.setViewportSize(page.viewportSize()!);
  await mockPage.goto(mockUrl(mock));
  const shot = await mockPage.locator(selector).first().screenshot({ animations: 'disabled' });
  await mockPage.close();
  return shot;
}

export async function region(locator: Locator): Promise<Buffer> {
  return locator.screenshot({ animations: 'disabled', caret: 'hide' });
}
