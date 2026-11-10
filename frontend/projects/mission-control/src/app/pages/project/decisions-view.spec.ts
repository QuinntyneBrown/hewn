import { commitLabel, recordedText, stageFilter } from './decisions-view';

describe('decisions view', () => {
  it('filters by a stage the list offers, else shows every stage', () => {
    expect(stageFilter('4')).toBe(4);
    expect(stageFilter('10')).toBe(10);
    expect(stageFilter(undefined)).toBeUndefined();
    expect(stageFilter('0')).toBeUndefined();
    expect(stageFilter('11')).toBeUndefined();
    expect(stageFilter('stack')).toBeUndefined();
  });

  it('shows the day, month and local time a decision was recorded', () => {
    expect(recordedText(new Date(2026, 10, 9, 14, 21).toISOString())).toBe('9 Nov, 14:21');
    expect(recordedText(new Date(2026, 10, 8, 9, 5).toISOString())).toBe('8 Nov, 09:05');
  });

  it('names the commit a link opens', () => {
    expect(commitLabel('a41c9e2f00d1')).toBe('Open commit a41c9e2 on GitHub');
  });
});
