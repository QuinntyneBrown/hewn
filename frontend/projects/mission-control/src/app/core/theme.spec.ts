import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme, saveTheme, THEME_KEY } from './theme';

/** A Storage that holds values, or throws on every call as a blocked or private window's can. */
function storage(values: Record<string, string> = {}, broken = false): Storage {
  const fail = () => {
    throw new Error('blocked');
  };
  return {
    getItem: (k: string) => (broken ? fail() : (values[k] ?? null)),
    setItem: (k: string, v: string) => (broken ? fail() : void (values[k] = v)),
    removeItem: (k: string) => (broken ? fail() : void delete values[k]),
  } as Storage;
}

function root(): HTMLElement & { attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    setAttribute: (k: string, v: string) => void (attrs[k] = v),
    removeAttribute: (k: string) => void delete attrs[k],
  } as unknown as HTMLElement & { attrs: Record<string, string> };
}

describe('theme', () => {
  it('is System with no saved choice, an unknown one, or storage that cannot be read', () => {
    expect(readTheme(storage())).toBe('system');
    expect(readTheme(storage({ [THEME_KEY]: 'sepia' }))).toBe('system');
    expect(readTheme(storage({}, true))).toBe('system');
  });

  it('reads a saved Light or Dark back', () => {
    expect(readTheme(storage({ [THEME_KEY]: 'dark' }))).toBe('dark');
    expect(readTheme(storage({ [THEME_KEY]: 'light' }))).toBe('light');
  });

  it('saves the choice under hewn.theme, and a storage failure only loses the choice', () => {
    const values: Record<string, string> = {};
    saveTheme(storage(values), 'dark');
    expect(values).toEqual({ 'hewn.theme': 'dark' });
    saveTheme(storage(values), 'system');
    expect(values).toEqual({ 'hewn.theme': 'system' });
    expect(() => saveTheme(storage({}, true), 'light')).not.toThrow();
  });

  it('sets data-theme for Light and Dark, and removes it for System so the OS decides', () => {
    const el = root();
    applyTheme(el, 'dark');
    expect(el.attrs).toEqual({ 'data-theme': 'dark' });
    applyTheme(el, 'light');
    expect(el.attrs).toEqual({ 'data-theme': 'light' });
    applyTheme(el, 'system');
    expect(el.attrs).toEqual({});
  });
});
