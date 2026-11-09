import { describe, expect, it } from 'vitest';
import { kebab } from './stage-plan';

describe('kebab (the repository name Hewn would create)', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(kebab('Field Notes')).toBe('field-notes');
    expect(kebab('  Kiln -- Booking!! ')).toBe('kiln-booking');
  });

  it('returns an empty string when nothing alphanumeric is left', () => {
    expect(kebab('—')).toBe('');
  });
});
