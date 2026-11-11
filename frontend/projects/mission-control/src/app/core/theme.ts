import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

/** Light and Dark set the theme; System leaves it to the operating system's `prefers-color-scheme` (L2-048). */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Where the choice is kept, on this device only. index.html reads the same key before the app starts. */
export const THEME_KEY = 'hewn.theme';

/** The saved choice; System when there is none, it is unknown, or storage can't be read (a blocked or private window). */
export function readTheme(storage: Storage): ThemeChoice {
  try {
    const saved = storage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** Keeps the choice. If storage refuses, the theme still applies now and only the choice is lost on reload. */
export function saveTheme(storage: Storage, choice: ThemeChoice): void {
  try {
    storage.setItem(THEME_KEY, choice);
  } catch {
    // Nothing to do: the page already shows the choice.
  }
}

/**
 * The tokens switch on `data-theme` on the root: `dark` and `light` force a theme, and with no attribute
 * `prefers-color-scheme` decides, so System follows the OS live.
 */
export function applyTheme(root: HTMLElement, choice: ThemeChoice): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** The window's local storage, or one that holds nothing when even reaching it throws. */
function localStorageOf(doc: Document): Storage {
  try {
    return doc.defaultView!.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined } as unknown as Storage;
  }
}

/** The theme choice for the whole app, applied to `<html>` and kept in local storage. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly storage = localStorageOf(inject(DOCUMENT));
  private readonly current = signal<ThemeChoice>(readTheme(this.storage));
  readonly choice = this.current.asReadonly();

  constructor() {
    applyTheme(this.root, this.current());
  }

  choose(choice: ThemeChoice): void {
    this.current.set(choice);
    applyTheme(this.root, choice);
    saveTheme(this.storage, choice);
  }
}
