// Acceptance Test
// Traces to: L2-010, L2-012
// Description: Stage 2 fails on unmapped features, missing states, unparseable HTML or horizontal scroll; stage 3 fails on missing token groups and colours with no token

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeBrowser, validateMocks } from '../src/validators/mock-validator.ts';
import {
  tokenMismatches,
  validateDesignSystem,
  validateTokenCoverage,
} from '../src/validators/design-system-validators.ts';

let dir: string;
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
};

const BRIEF = `# Brief\n\n## Problem\nX\n\n## Users\nY\n\n## Core features\n- Sign in\n- Book a slot\n\n## Out of scope\n- Z\n\n## Assumptions\n- W\n`;
const html = (body: string, style = '') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title><style>body{margin:0;color:#1f2937}${style}</style></head><body>${body}</body></html>`;

function screen(name: string, feature: string, states = ['default', 'loading', 'empty', 'error'], notApplicable = {}) {
  for (const state of states) write(`docs/mocks/${name}/${state}.html`, html(`<main>${name} ${state}</main>`));
  return {
    screen: name,
    feature,
    magicPatternsUrl: `https://www.magicpatterns.com/c/${name}`,
    editorId: name,
    states,
    notApplicable,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hewn-design-'));
  write('docs/brief.md', BRIEF);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('validateMocks (stage 2)', () => {
  beforeAll(() => undefined);
  afterAll(async () => closeBrowser());

  it('accepts a design for every core feature with every state, parsing and fitting at each width', async () => {
    write(
      'docs/mocks/manifest.json',
      JSON.stringify({ screens: [screen('sign-in', 'Sign in'), screen('book-a-slot', 'Book a slot')] }),
    );

    expect(await validateMocks(dir)).toEqual([]);
  }, 30_000);

  it('accepts a missing state with a recorded reason', async () => {
    write(
      'docs/mocks/manifest.json',
      JSON.stringify({
        screens: [
          screen('sign-in', 'Sign in', ['default', 'loading', 'error'], {
            empty: 'A sign-in form has no empty state.',
          }),
          screen('book-a-slot', 'Book a slot'),
        ],
      }),
    );

    expect(await validateMocks(dir)).toEqual([]);
  }, 30_000);

  it('names unmapped features, missing states and missing Magic Patterns URLs', async () => {
    const signIn = { ...screen('sign-in', 'Sign in', ['default', 'loading']), magicPatternsUrl: '' };
    write('docs/mocks/manifest.json', JSON.stringify({ screens: [signIn] }));

    expect(await validateMocks(dir)).toEqual([
      'No design covers the core feature "Book a slot"',
      'sign-in has no Magic Patterns URL',
      'sign-in has no empty state and no reason it does not apply',
      'sign-in has no error state and no reason it does not apply',
    ]);
  }, 30_000);

  it('names files that do not parse or scroll sideways, with the width', async () => {
    const book = screen('book-a-slot', 'Book a slot');
    write('docs/mocks/book-a-slot/error.html', html('<main><div style="width:900px">wide</div></main>'));
    write('docs/mocks/book-a-slot/empty.html', '<html><body><p>unclosed</div></body></html>');
    write('docs/mocks/manifest.json', JSON.stringify({ screens: [screen('sign-in', 'Sign in'), book] }));

    const problems = await validateMocks(dir);

    expect(problems).toContain('docs/mocks/book-a-slot/error.html scrolls horizontally at 375 px');
    expect(problems).toContain('docs/mocks/book-a-slot/error.html scrolls horizontally at 768 px');
    expect(problems).not.toContain('docs/mocks/book-a-slot/error.html scrolls horizontally at 1280 px');
    expect(problems.some((p) => p.startsWith('docs/mocks/book-a-slot/empty.html does not parse:'))).toBe(true);
  }, 30_000);

  it('fails without a manifest', async () => {
    expect(await validateMocks(dir)).toEqual(['docs/mocks/manifest.json does not exist']);
  });
});

const TOKENS = {
  color: {
    light: { surface: { $type: 'color', $value: '#ffffff' }, text: { $type: 'color', $value: '#1f2937' } },
    dark: { surface: { $type: 'color', $value: '#111827' }, text: { $type: 'color', $value: '#f9fafb' } },
  },
  typography: { body: { $type: 'fontFamily', $value: 'system-ui' } },
  spacing: { '4': { $type: 'dimension', $value: '16px' } },
  radius: { md: { $type: 'dimension', $value: '8px' } },
  elevation: { '1': { $type: 'shadow', $value: '0 1px 2px #0000001a' } },
  motion: { fast: { $type: 'duration', $value: '150ms' } },
};

describe('validateDesignSystem (stage 3)', () => {
  it('accepts every token group and a page per component', () => {
    write('docs/design-system/tokens.json', JSON.stringify(TOKENS));
    write('docs/design-system/components/button.html', '<h1>Button</h1>');

    expect(validateDesignSystem(dir)).toEqual([]);
  });

  it('names missing groups and the missing component pages', () => {
    const { motion: _m, ...rest } = TOKENS;
    write('docs/design-system/tokens.json', JSON.stringify({ ...rest, color: { light: TOKENS.color.light } }));

    expect(validateDesignSystem(dir)).toEqual([
      'docs/design-system/tokens.json has no color.dark tokens',
      'docs/design-system/tokens.json has no motion tokens',
      'docs/design-system/components holds no component pages',
    ]);
  });
});

describe('validateTokenCoverage (stage 3)', () => {
  beforeEach(() => write('docs/design-system/tokens.json', JSON.stringify(TOKENS)));

  it('accepts mocks whose colours all match a token, in any notation', () => {
    write(
      'docs/mocks/a/default.html',
      html(
        '',
        'main{background:#FFF;border-color:rgb(31, 41, 55)} @media (prefers-color-scheme: dark){body{color:#111827}}',
      ),
    );

    expect(validateTokenCoverage(dir)).toEqual([]);
  });

  it('lists each colour with no token, once', () => {
    write(
      'docs/mocks/a/default.html',
      html('<p style="color:#ff0000">x</p>', 'a{color:#ff0000} b{color:hsl(120 100% 25%)}'),
    );

    expect(validateTokenCoverage(dir)).toEqual([
      '#ff0000 in docs/mocks/a/default.html matches no token',
      '#008000 in docs/mocks/a/default.html matches no token',
    ]);
  });
});

describe('tokenMismatches (stage 3)', () => {
  it('lists Magic Patterns colours the extracted tokens do not contain', () => {
    write('docs/design-system/tokens.json', JSON.stringify(TOKENS));

    expect(
      tokenMismatches(dir, { '--color-surface': '#ffffff', '--color-primary': '#2563eb', '--radius': '8px' }),
    ).toEqual(['Magic Patterns --color-primary is #2563eb; no extracted colour token matches']);
  });
});
