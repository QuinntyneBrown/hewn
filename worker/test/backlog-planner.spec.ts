// Acceptance Test
// Traces to: L2-018, L2-019, L2-020
// Description: Stage 9 descopes oversized, out-of-scope and off-journey designs with reasons, marks their L2s Deferred, and orders increments by journey without any increment preceding one it depends on

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planBacklog } from '../src/estimates/backlog-planner.ts';
import { validateEstimates } from '../src/validators/estimate-validator.ts';

let dir: string;
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
};
const read = (path: string) => readFileSync(join(dir, path), 'utf8');

const BRIEF = `# Brief\n\n## Problem\nX\n\n## Users\nY\n\n## Core features\n- Bookings\n\n## Out of scope\n- Payroll\n\n## Nice to have\n- Dark mode toggle\n\n## Assumptions\n- W\n`;

const L2 = ['001', '002', '003', '004', '005', '006', '007']
  .map(
    (n) =>
      `## L2-${n}: Requirement ${n}\n**Traces to:** L1-001\n\n**Acceptance Criteria:**\n1. Given x, when y, then z.\n`,
  )
  .join('\n');

function design(path: string, title: string, l2: string[], dependsOn: string[] = []): void {
  write(
    `docs/detailed-designs/${path}/README.md`,
    `# ${title}\n\n${dependsOn.length ? `**Depends on:** ${dependsOn.join(', ')}\n\n` : ''}## Requirements\n${l2.map((id) => `- ${id}`).join('\n')}\n`,
  );
}

function estimates(subsystem: string, rows: [feature: string, days: number, complete?: number][]): void {
  write(
    `docs/estimates/${subsystem}.md`,
    `# ${subsystem}\n\n| Design | Estimate (days) | Complete |\n|---|---:|---:|\n${rows
      .map(([f, d, c = 0]) => `| [${f}](../detailed-designs/${subsystem}/${f}/README.md) | ${d} | ${c}% |`)
      .join('\n')}\n`,
  );
}

function journeys(entries: [number, string, string[]][]): void {
  write(
    'docs/journeys.md',
    `# User journeys\n\n${entries
      .map(
        ([n, title, covers]) =>
          `## ${n}. ${title}\n\n**Actor:** User\n\n**Mocks:** docs/mocks/x/default.html\n\n**Covers:** ${covers.join(', ')}\n\n**Steps:**\n1. Go.\n`,
      )
      .join('\n')}`,
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hewn-backlog-'));
  write('docs/brief.md', BRIEF);
  write('docs/specs/L2.md', `# L2\n\n${L2}`);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('planBacklog', () => {
  beforeEach(() => {
    design('bookings/book-slot', 'Book a slot', ['L2-001'], ['bookings/calendar']);
    design('bookings/calendar', 'Calendar', ['L2-002']);
    design('bookings/waitlist', 'Waitlist', ['L2-003']);
    design('accounts/sign-in', 'Sign in', ['L2-004']);
    design('accounts/payroll', 'Payroll export', ['L2-005']);
    design('accounts/theme', 'Dark mode toggle', ['L2-006']);
    design('reports/forecast', 'Forecast', ['L2-007']);
    estimates('bookings', [
      ['book-slot', 2],
      ['calendar', 2.5, 50],
      ['waitlist', 4],
    ]);
    estimates('accounts', [
      ['sign-in', 1, 100],
      ['payroll', 1],
      ['theme', 0.5],
    ]);
    estimates('reports', [['forecast', 2]]);
    journeys([
      [1, 'Sign in', ['L2-004']],
      [2, 'Book a slot', ['L2-001', 'L2-002', 'L2-003', 'L2-005', 'L2-006']],
    ]);
  });

  it('descopes oversized, out-of-scope, nice-to-have and off-journey designs, each with its reason', () => {
    const plan = planBacklog(dir, 3);

    expect(plan.deferred).toEqual([
      {
        design: 'bookings/waitlist',
        title: 'Waitlist',
        l2Ids: ['L2-003'],
        estimateDays: 4,
        reason: 'Estimated at 4 days, above the 3-day threshold, and could not be split',
      },
      {
        design: 'accounts/payroll',
        title: 'Payroll export',
        l2Ids: ['L2-005'],
        estimateDays: 1,
        reason: 'Listed as out of scope in the brief: Payroll',
      },
      {
        design: 'accounts/theme',
        title: 'Dark mode toggle',
        l2Ids: ['L2-006'],
        estimateDays: 0.5,
        reason: 'Listed as nice-to-have in the brief: Dark mode toggle',
      },
      {
        design: 'reports/forecast',
        title: 'Forecast',
        l2Ids: ['L2-007'],
        estimateDays: 2,
        reason: "Its requirements appear in no journey's main path",
      },
    ]);
  });

  it('orders increments by journey, after the increments they depend on', () => {
    const plan = planBacklog(dir, 3);

    expect(
      plan.increments.map((i) => ({
        n: i.number,
        title: i.title,
        journey: i.journey,
        l2: i.l2Ids,
        days: i.estimateDays,
        deps: i.dependsOn,
      })),
    ).toEqual([
      { n: 1, title: 'Sign in', journey: 1, l2: ['L2-004'], days: 1, deps: [] },
      { n: 2, title: 'Book a slot (part 1 of 2)', journey: 2, l2: ['L2-002'], days: 2.5, deps: [] },
      { n: 3, title: 'Book a slot (part 2 of 2)', journey: 2, l2: ['L2-001'], days: 2, deps: [2] },
    ]);
  });

  it('writes the estimates README with the overall estimate, percent complete, roadmap and deferred designs', () => {
    planBacklog(dir, 3);

    const readme = read('docs/estimates/README.md');
    expect(readme).toContain('**Overall estimate:** 5.5 ideal days across 3 designs');
    expect(readme).toContain('**Percent complete:** 41%');
    expect(readme).toMatch(/## Roadmap[\s\S]*\| 3 \| Book a slot \(part 2 of 2\) \| 2 \| L2-001 \| 2 \| 2 \|/);
    expect(readme).toMatch(/## Deferred[\s\S]*\| Waitlist \| L2-003 \| 4 \| Estimated at 4 days/);
  });

  it('marks each deferred L2 with its reason, once', () => {
    planBacklog(dir, 3);
    planBacklog(dir, 3);

    const l2 = read('docs/specs/L2.md');
    expect(l2).toContain(
      '## L2-003: Requirement 003\n**Status:** Deferred (Estimated at 4 days, above the 3-day threshold, and could not be split)\n**Traces to:** L1-001',
    );
    expect(l2.match(/\*\*Status:\*\* Deferred/g)).toHaveLength(4);
    expect(l2).not.toMatch(/## L2-001[^\n]*\n\*\*Status/);
  });

  it('defers a design that depends on a deferred one', () => {
    design('bookings/book-slot', 'Book a slot', ['L2-001'], ['bookings/waitlist']);

    const plan = planBacklog(dir, 3);

    expect(plan.deferred.find((d) => d.design === 'bookings/book-slot')?.reason).toBe(
      'Depends on a deferred design: bookings/waitlist',
    );
  });

  it('ignores designs marked as split', () => {
    write(
      'docs/detailed-designs/bookings/waitlist/README.md',
      '# Waitlist\n\n**Status:** Split into bookings/waitlist-join, bookings/waitlist-notify\n\n- L2-003\n',
    );
    design('bookings/waitlist-join', 'Join the waitlist', ['L2-003']);
    estimates('bookings', [
      ['book-slot', 2],
      ['calendar', 2.5, 50],
      ['waitlist-join', 2],
    ]);

    const plan = planBacklog(dir, 3);

    expect(plan.deferred.map((d) => d.design)).not.toContain('bookings/waitlist');
    expect(plan.increments.flatMap((i) => i.l2Ids)).toContain('L2-003');
  });

  it('fails when increments depend on each other in a cycle', () => {
    design('bookings/calendar', 'Calendar', ['L2-002'], ['bookings/book-slot']);

    expect(() => planBacklog(dir, 3)).toThrow(
      'Designs depend on each other in a cycle: bookings/book-slot, bookings/calendar',
    );
  });
});

describe('validateEstimates', () => {
  it('lists designs with no estimate, and accepts a complete set', () => {
    design('bookings/book-slot', 'Book a slot', ['L2-001']);
    design('bookings/calendar', 'Calendar', ['L2-002']);
    estimates('bookings', [['book-slot', 2]]);

    expect(validateEstimates(dir)).toEqual(['No estimate for docs/detailed-designs/bookings/calendar']);
    estimates('bookings', [
      ['book-slot', 2],
      ['calendar', 1],
    ]);
    expect(validateEstimates(dir)).toEqual([]);
  });
});
