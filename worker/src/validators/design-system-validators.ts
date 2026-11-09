import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colorsIn, normalizeColor } from './colors.ts';
import type { Problems } from './document-validators.ts';

export const TOKENS = 'docs/design-system/tokens.json';
const COMPONENTS = 'docs/design-system/components';
const GROUPS = ['color.light', 'color.dark', 'typography', 'spacing', 'radius', 'elevation', 'motion'] as const;

type TokenTree = { [key: string]: TokenTree | string | number | undefined };

/** Stage 3 (L2-012 AC1): every token group, and a page per component. */
export function validateDesignSystem(workspace: string): Problems {
  const tokens = readTokens(workspace);
  if (tokens === null) return [`${TOKENS} does not exist`];
  if (tokens === 'invalid') return [`${TOKENS} is not valid JSON`];

  const problems: Problems = [];
  for (const group of GROUPS) {
    const node = group.split('.').reduce<TokenTree | undefined>((n, key) => n?.[key] as TokenTree | undefined, tokens);
    if (node === undefined || leaves(node).length === 0) problems.push(`${TOKENS} has no ${group} tokens`);
  }
  const pages = existsSync(join(workspace, COMPONENTS))
    ? readdirSync(join(workspace, COMPONENTS)).filter((f) => f.endsWith('.html'))
    : [];
  if (pages.length === 0) problems.push(`${COMPONENTS} holds no component pages`);
  return problems;
}

/** Stage 3 (L2-012 AC2): every colour used in docs/mocks/ matches a colour token in either theme. */
export function validateTokenCoverage(workspace: string): Problems {
  const palette = colorTokens(workspace);
  const problems: Problems = [];
  for (const path of mockFiles(workspace)) {
    const seen = new Set<string>();
    for (const color of colorsIn(readFileSync(join(workspace, path), 'utf8'))) {
      if (palette.has(color) || seen.has(color)) continue;
      seen.add(color);
      problems.push(`${color} in ${path} matches no token`);
    }
  }
  return problems;
}

/** Stage 3 (L2-012 AC3): Magic Patterns colour settings with no matching extracted token, for the run log. */
export function tokenMismatches(workspace: string, magicPatterns: Record<string, string>): string[] {
  const palette = colorTokens(workspace);
  return Object.entries(magicPatterns).flatMap(([name, value]) => {
    const color = normalizeColor(value);
    return color === null || palette.has(color)
      ? []
      : [`Magic Patterns ${name} is ${value}; no extracted colour token matches`];
  });
}

function readTokens(workspace: string): TokenTree | null | 'invalid' {
  const path = join(workspace, TOKENS);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TokenTree;
  } catch {
    return 'invalid';
  }
}

function leaves(node: TokenTree): string[] {
  if ('$value' in node) return [String(node.$value)];
  return Object.entries(node)
    .filter(([key, child]) => !key.startsWith('$') && typeof child === 'object' && child !== null)
    .flatMap(([, child]) => leaves(child as TokenTree));
}

function colorTokens(workspace: string): Set<string> {
  const tokens = readTokens(workspace);
  const color = tokens && tokens !== 'invalid' ? (tokens.color as TokenTree | undefined) : undefined;
  return new Set((color ? leaves(color) : []).map((v) => normalizeColor(v)).filter((v): v is string => v !== null));
}

function mockFiles(workspace: string): string[] {
  const root = join(workspace, 'docs/mocks');
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) =>
      join(e.parentPath, e.name)
        .slice(workspace.length + 1)
        .replaceAll('\\', '/'),
    )
    .sort();
}
