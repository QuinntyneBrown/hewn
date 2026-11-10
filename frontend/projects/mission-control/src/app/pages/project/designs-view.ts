import { Designs, DesignScreen, DesignState } from '@hewn/api';

export type PreviewTheme = 'light' | 'dark';

/** The preview widths of L2-011 AC3. */
export const WIDTHS = [
  { size: 'XS', px: 375 },
  { size: 'S', px: 576 },
  { size: 'M', px: 768 },
  { size: 'L', px: 992 },
  { size: 'XL', px: 1200 },
] as const;

export type PreviewWidth = (typeof WIDTHS)[number]['px'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "6 screens · 17 states · exported to docs/mocks/" */
export function caption(designs: Designs): string {
  return `${plural(designs.screens.length, 'screen')} · ${plural(designs.stateCount, 'state')} · exported to docs/mocks/`;
}

/** The state shown in the preview: the one chosen while it still exists, else the first. */
export function selection(
  designs: Designs,
  path: string | null,
): { screen: DesignScreen; state: DesignState } | null {
  const all = designs.screens.flatMap((screen) =>
    screen.states.map((state) => ({ screen, state })),
  );
  return all.find((s) => s.state.path === path) ?? all[0] ?? null;
}

/** The preview host themes the page by `?theme=`. */
export function previewSrc(previewUrl: string, theme: PreviewTheme): string {
  return `${previewUrl}?theme=${theme}`;
}

/** The preview origin's host, as the caption names it. */
export function previewHost(previewUrl: string): string {
  return new URL(previewUrl).host;
}

export function frameLabel(screen: string, state: string, px: number, theme: PreviewTheme): string {
  return `Exported mock: ${screen}, ${state} state, ${px} px, ${theme}`;
}
