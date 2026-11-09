import { describe, expect, it } from 'vitest';
import { FEATURE_PLAN, kebab, productLabel } from './stage-plan';

describe('kebab (the repository name Hewn would create)', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(kebab('Field Notes')).toBe('field-notes');
    expect(kebab('  Kiln -- Booking!! ')).toBe('kiln-booking');
  });

  it('returns an empty string when nothing alphanumeric is left', () => {
    expect(kebab('—')).toBe('');
  });
});

describe('the feature direction plan', () => {
  it('skips Bootstrap, Stack and Scaffold and keeps every other stage', () => {
    expect(FEATURE_PLAN.filter((s) => s.skipped).map((s) => s.name)).toEqual([
      'Bootstrap',
      'Stack',
      'Scaffold',
    ]);
    expect(FEATURE_PLAN).toHaveLength(11);
  });
});

describe('productLabel', () => {
  const p = {
    name: 'Northwind Ops',
    repository: 'northwind/ops-portal',
    status: 'Idle',
    firstDirectionComplete: true,
  };

  it('shows the repository of a product whose first direction is complete', () => {
    expect(productLabel(p)).toBe('Northwind Ops · northwind/ops-portal');
  });

  it('says a feature would queue behind a running or paused first direction', () => {
    expect(productLabel({ ...p, status: 'Running', firstDirectionComplete: false })).toBe(
      'Northwind Ops · queues behind the running direction',
    );
    expect(productLabel({ ...p, status: 'Paused', firstDirectionComplete: false })).toBe(
      'Northwind Ops · queues behind the paused direction',
    );
  });
});
