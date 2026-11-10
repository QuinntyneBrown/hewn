import { DesignSystem, DesignSystemPage } from '@hewn/api';
import { PreviewTheme } from './designs-view';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "6 foundations · 7 components · docs/design-system/ at 8e2290a" */
export function systemCaption(system: DesignSystem): string {
  const at = system.sha ? ` at ${system.sha.slice(0, 7)}` : '';
  return `${plural(system.foundations.length, 'foundation')} · ${plural(system.components.length, 'component')} · docs/design-system/${at}`;
}

/** The page shown in the preview: the one chosen while it still exists, else the first token page or component. */
export function pageSelection(system: DesignSystem, path: string | null): DesignSystemPage | null {
  const all = [...system.foundations, ...system.components];
  return all.find((p) => p.path === path) ?? all[0] ?? null;
}

/** "38 tokens, light and dark" beside a token page's title; nothing for a component. */
export function pageDetail(page: DesignSystemPage): string {
  if (page.tokenCount === null) return '';
  return `${plural(page.tokenCount, 'token')}${page.lightAndDark ? ', light and dark' : ''}`;
}

export function pageLabel(title: string, px: number, theme: PreviewTheme): string {
  return `Design system page: ${title}, ${px} px, ${theme}`;
}
