import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { chromium, type Browser } from 'playwright-core';
import type { Problems } from './document-validators.ts';

export const MANIFEST = 'docs/mocks/manifest.json';
export const REQUIRED_STATES = ['default', 'loading', 'empty', 'error'] as const;
const WIDTHS = [375, 768, 1280] as const;

/** One designed screen, as stage 2 records it in `docs/mocks/manifest.json` (L2-010 AC2). */
export interface ManifestScreen {
  screen: string;
  /** The brief's core feature this screen serves. */
  feature: string;
  magicPatternsUrl: string;
  editorId: string;
  states: string[];
  /** State name to the reason it does not apply. */
  notApplicable?: Record<string, string>;
}

export function mockPath(screen: string, state: string): string {
  return `docs/mocks/${screen}/${state}.html`;
}

export function readManifest(workspace: string): ManifestScreen[] | null {
  const path = join(workspace, MANIFEST);
  if (!existsSync(path)) return null;
  return (JSON.parse(readFileSync(path, 'utf8')) as { screens: ManifestScreen[] }).screens;
}

/** Stage 2 (L2-010 AC2-AC4). */
export async function validateMocks(workspace: string): Promise<Problems> {
  let screens: ManifestScreen[] | null;
  try {
    screens = readManifest(workspace);
  } catch {
    return [`${MANIFEST} is not valid JSON`];
  }
  if (screens === null) return [`${MANIFEST} does not exist`];

  const problems: Problems = [];
  for (const feature of coreFeatures(workspace)) {
    if (!screens.some((s) => s.feature === feature)) problems.push(`No design covers the core feature "${feature}"`);
  }

  const files: string[] = [];
  for (const s of screens) {
    if (!s.magicPatternsUrl) problems.push(`${s.screen} has no Magic Patterns URL`);
    for (const state of REQUIRED_STATES) {
      if (!s.states.includes(state) && !s.notApplicable?.[state]?.trim()) {
        problems.push(`${s.screen} has no ${state} state and no reason it does not apply`);
      }
    }
    for (const state of s.states) {
      const path = mockPath(s.screen, state);
      if (existsSync(join(workspace, path))) files.push(path);
      else problems.push(`${path} does not exist`);
    }
  }

  const renderable: string[] = [];
  for (const path of files) {
    const errors: string[] = [];
    parse(readFileSync(join(workspace, path), 'utf8'), { onParseError: (e) => void errors.push(e.code) });
    if (errors.length > 0) problems.push(`${path} does not parse: ${[...new Set(errors)].join(', ')}`);
    else renderable.push(path);
  }

  if (renderable.length > 0) {
    const page = await (await browser()).newPage();
    try {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        for (const path of renderable) {
          await page.goto(pathToFileURL(join(workspace, path)).href, { waitUntil: 'load' });
          const scrolls = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          );
          if (scrolls) problems.push(`${path} scrolls horizontally at ${width} px`);
        }
      }
    } finally {
      await page.close();
    }
  }
  return problems;
}

let shared: Promise<Browser> | null = null;

function browser(): Promise<Browser> {
  shared ??= chromium.launch();
  return shared;
}

export async function closeBrowser(): Promise<void> {
  const current = shared;
  shared = null;
  await (await current)?.close();
}

function coreFeatures(workspace: string): string[] {
  const path = join(workspace, 'docs/brief.md');
  if (!existsSync(path)) return [];
  const body =
    readFileSync(path, 'utf8')
      .split(/^## Core features\s*$/m)[1]
      ?.split(/^## /m)[0] ?? '';
  return [...body.matchAll(/^-\s+(.+)$/gm)].map((m) => m[1]!.split(' — ')[0]!.trim());
}
