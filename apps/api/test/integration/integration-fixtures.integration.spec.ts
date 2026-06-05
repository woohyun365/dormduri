import {
  DEFAULT_LIFESTYLE,
  toCompleteLifestyleColumnData,
} from './support/integration-fixtures.js';

describe('integration fixtures', () => {
  it('complete lifestyle helper returns persisted columns without nullable values', () => {
    const columns = toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE);

    expect(Object.values(columns)).not.toContain(null);
    expect(columns.bedtime).toBe('BETWEEN_22_24');
    expect(columns.wakeTime).toBe('BETWEEN_07_08');
  });
});
