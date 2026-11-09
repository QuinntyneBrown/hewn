import { describe, expect, it } from 'vitest';
import { formatDuration, headerStatus, directionTitle, featureOutcome } from './pipeline-view';

describe('formatDuration', () => {
  it('shows a dash for a stage that has not started', () => {
    expect(formatDuration(null, null, 0)).toBe('—');
  });

  it('formats like the mocks: m:ss under an hour, h:mm:ss above', () => {
    const start = '2026-11-08T10:00:00Z';
    expect(formatDuration(start, '2026-11-08T10:00:41Z', 0)).toBe('0:41');
    expect(formatDuration(start, '2026-11-08T10:48:30Z', 0)).toBe('48:30');
    expect(formatDuration(start, '2026-11-08T13:12:48Z', 0)).toBe('3:12:48');
  });

  it('counts a running stage up to now', () => {
    expect(formatDuration('2026-11-08T10:00:00Z', null, Date.parse('2026-11-08T10:01:05Z'))).toBe(
      '1:05',
    );
  });
});

describe('headerStatus', () => {
  it('follows the direction: Running while queued or running, Complete when done', () => {
    expect(headerStatus('Running', 'Queued')).toBe('Running');
    expect(headerStatus('Running', 'Running')).toBe('Running');
    expect(headerStatus('Idle', 'Complete')).toBe('Complete');
    expect(headerStatus('Paused', 'Paused')).toBe('Paused');
    expect(headerStatus('Cancelled', 'Cancelled')).toBe('Cancelled');
  });

  it('shows Blocked whenever the project is blocked', () => {
    expect(headerStatus('Blocked', 'Running')).toBe('Blocked');
  });

  it('falls back to the project status without a direction', () => {
    expect(headerStatus('Idle', null)).toBe('Idle');
  });
});

describe('directionTitle', () => {
  it('takes the first clause of the first sentence', () => {
    expect(directionTitle('Add a CSV export of the shift report, one row per shift. More.')).toBe(
      'Add a CSV export of the shift report',
    );
    expect(directionTitle('Export a reconciled period as PDF.')).toBe(
      'Export a reconciled period as PDF',
    );
  });
});

describe('featureOutcome', () => {
  it('names the skipped design stages and the recorded reason when the UI does not change', () => {
    expect(featureOutcome('Northwind Ops', false, 'The feature adds no screen or state')).toBe(
      'Bootstrap, stack and scaffold were skipped. Designs and design system were skipped too: The feature adds no screen or state. Northwind Ops is Idle until the next direction.',
    );
  });

  it('mentions only the always-skipped stages when the UI changes', () => {
    expect(featureOutcome('Northwind Ops', true, 'It adds a page.')).toBe(
      'Bootstrap, stack and scaffold were skipped. Northwind Ops is Idle until the next direction.',
    );
  });
});
