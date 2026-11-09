// Acceptance Test
// Traces to: L2-009, L2-013, L2-014, L2-016, L2-017
// Description: Each document stage's validator fails the run on a missing section, a broken trace or an uncovered requirement, naming what is wrong

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  validateBrief,
  validateDesignCoverage,
  validateJourneys,
  validateRequirements,
  validateStackDecision,
} from '../src/validators/document-validators.ts';

let dir: string;
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
};

beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'hewn-validate-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const BRIEF = `# Ledgerline brief

## Problem
Small teams reconcile statements by hand.

## Users
Bookkeepers in teams of 2 to 10.

## Core features
- Import statements

## Out of scope
- Payroll

## Assumptions
- Teams already scan receipts.
`;

const L1 = `# L1

## L1-001: Statements
Import and reconcile statements.

## L1-002: Reviews
A second person closes the month.
`;

const L2 = `# L2

## L2-001: Import a statement
**Traces to:** L1-001

**Acceptance Criteria:**
1. Given a CSV, when the bookkeeper uploads it on the Import page, then each row appears as a transaction.

## L2-002: Close a month
**Traces to:** L1-002

**Acceptance Criteria:**
1. Given every transaction is matched, when the reviewer approves, then the month is closed.
`;

describe('validateBrief (stage 1)', () => {
  it('accepts a brief with every required section filled', () => {
    write('docs/brief.md', BRIEF);

    expect(validateBrief(dir)).toEqual([]);
  });

  it('names missing and empty sections', () => {
    write(
      'docs/brief.md',
      BRIEF.replace('## Users\nBookkeepers in teams of 2 to 10.\n', '').replace('- Teams already scan receipts.\n', ''),
    );

    expect(validateBrief(dir)).toEqual([
      'docs/brief.md is missing the Users section',
      'docs/brief.md has an empty Assumptions section',
    ]);
  });

  it('fails when the brief does not exist', () => {
    expect(validateBrief(dir)).toEqual(['docs/brief.md does not exist']);
  });
});

describe('validateStackDecision (stage 4)', () => {
  const adr = (decision: string) =>
    `# 0001. Stack\n\n## Context\nA web app.\n\n## Decision\n${decision}\n\n## Alternatives\nNode.\n\n## Consequences\nOne language per tier.\n`;

  it('accepts the default .NET and Angular stack when no preference was given', () => {
    write('docs/adr/0001-stack.md', adr('.NET 10 (LTS) backend with an Angular 21 frontend.'));

    expect(validateStackDecision(dir, null)).toEqual([]);
  });

  it('requires .NET and Angular when no preference was given', () => {
    write('docs/adr/0001-stack.md', adr('Go with React.'));

    expect(validateStackDecision(dir, null)).toEqual([
      'docs/adr/0001-stack.md must choose the current LTS .NET backend and current major Angular frontend when no stack was named',
    ]);
  });

  it('requires the named stack when the direction gave one', () => {
    write('docs/adr/0001-stack.md', adr('.NET 10 backend with an Angular 21 frontend.'));

    expect(validateStackDecision(dir, 'Go + React')).toEqual([
      'docs/adr/0001-stack.md must choose the named stack "Go + React"',
    ]);
    write('docs/adr/0001-stack.md', adr('Stack: Go + React, as the direction asked.'));
    expect(validateStackDecision(dir, 'Go + React')).toEqual([]);
  });

  it('names missing sections', () => {
    write('docs/adr/0001-stack.md', '# 0001. Stack\n\n## Decision\n.NET and Angular.\n');

    expect(validateStackDecision(dir, null)).toEqual([
      'docs/adr/0001-stack.md is missing the Context section',
      'docs/adr/0001-stack.md is missing the Alternatives section',
      'docs/adr/0001-stack.md is missing the Consequences section',
    ]);
  });
});

describe('validateRequirements (stage 5)', () => {
  it('accepts requirements where every trace, criterion and ID is sound', () => {
    write('docs/specs/L1.md', L1);
    write('docs/specs/L2.md', L2);

    expect(validateRequirements(dir)).toEqual([]);
  });

  it('lists every offending ID', () => {
    write('docs/specs/L1.md', L1 + '\n## L1-003: Exports\nCSV export.\n');
    write(
      'docs/specs/L2.md',
      L2 +
        `
## L2-002: Duplicate
**Traces to:** L1-002

1. Given x, when y, then z.

## L2-004: Orphan
**Traces to:** L1-009

1. Given x, when y, then z.

## L2-005: Vague
**Traces to:** L1-001

1. The page should load fast.
`,
    );

    expect(validateRequirements(dir)).toEqual([
      'Duplicate ID: L2-002',
      'L2-004 traces to L1-009, which does not exist',
      'L1-003 has no L2 requirement',
      'L2-005 has no Given/When/Then criterion',
      'L2-005 uses "should"',
    ]);
  });

  it('ignores the banned words inside quoted text and code', () => {
    write('docs/specs/L1.md', L1);
    write(
      'docs/specs/L2.md',
      L2.replace(
        'then the month is closed.',
        'then the banner reads "You may close this month" and `mightBeLate` is false.',
      ),
    );

    expect(validateRequirements(dir)).toEqual([]);
  });

  it('fails when a file is missing', () => {
    write('docs/specs/L1.md', L1);

    expect(validateRequirements(dir)).toEqual(['docs/specs/L2.md does not exist']);
  });
});

describe('validateDesignCoverage (stage 7)', () => {
  beforeEach(() => write('docs/specs/L2.md', L2));

  it('accepts designs that together cover every L2', () => {
    write('docs/detailed-designs/statements/import/README.md', '# Import\n\n## Requirements\n- L2-001\n');
    write('docs/detailed-designs/reviews/close-month/README.md', '# Close\n\n## Requirements\n- L2-002\n');

    expect(validateDesignCoverage(dir)).toEqual([]);
  });

  it('lists uncovered L2s and designs that name none', () => {
    write('docs/detailed-designs/statements/import/README.md', '# Import\n\nCovers L2-001.\n');
    write('docs/detailed-designs/reviews/close-month/README.md', '# Close\n\nTBD.\n');

    expect(validateDesignCoverage(dir)).toEqual([
      'docs/detailed-designs/reviews/close-month lists no L2 IDs',
      'No design covers L2-002',
    ]);
  });

  it('fails when there are no designs', () => {
    expect(validateDesignCoverage(dir)).toEqual([
      'docs/detailed-designs holds no {subsystem}/{feature}/README.md designs',
      'No design covers L2-001',
      'No design covers L2-002',
    ]);
  });
});

describe('validateJourneys (stage 8)', () => {
  beforeEach(() => write('docs/specs/L2.md', L2));

  const journey = (n: number, covers: string) =>
    `## ${n}. Import a statement\n\n**Actor:** Bookkeeper\n\n**Mocks:** docs/mocks/pages/import/default.html\n\n**Covers:** ${covers}\n\n**Steps:**\n1. Open Import.\n2. Upload a CSV.\n`;

  it('accepts numbered journeys with actor, steps, mocks and coverage of every UI requirement', () => {
    write('docs/journeys.md', `# User journeys\n\n${journey(1, 'L2-001')}`);

    expect(validateJourneys(dir)).toEqual([]);
  });

  it('names journeys missing a field and UI requirements no journey covers', () => {
    write('docs/journeys.md', `# User journeys\n\n${journey(1, 'L2-002').replace('**Actor:** Bookkeeper\n\n', '')}`);

    expect(validateJourneys(dir)).toEqual([
      'Journey 1 has no Actor',
      'No journey covers L2-001, which has a user interface criterion',
    ]);
  });

  it('rejects repeated journey numbers', () => {
    write('docs/journeys.md', `# User journeys\n\n${journey(1, 'L2-001')}\n${journey(1, 'L2-001')}`);

    expect(validateJourneys(dir)).toEqual(['Journey number 1 is used twice']);
  });
});
