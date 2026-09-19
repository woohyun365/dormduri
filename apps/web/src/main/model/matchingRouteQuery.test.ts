import { describe, expect, it } from 'vitest';
import { parseMatchingRouteQuery, serializeMatchingRouteQuery } from './matchingRouteQuery';

describe('matchingRouteQuery', () => {
  it('parses one allowlisted value for each owned key and preserves unrelated query params', () => {
    const parsed = parseMatchingRouteQuery(
      new URLSearchParams('source=home&section=past&requestTab=received&source=notice'),
    );

    expect(parsed.selection).toEqual({ section: 'past', requestTab: 'received' });
    expect(parsed.canonicalSearchParams.getAll('source')).toEqual(['home', 'notice']);
    expect(parsed.canonicalSearchParams.get('section')).toBe('past');
    expect(parsed.canonicalSearchParams.get('requestTab')).toBe('received');
    expect(parsed.needsCanonicalization).toBe(false);
  });

  it('drops malformed or duplicate owned keys from canonical output without consuming unrelated keys', () => {
    const parsed = parseMatchingRouteQuery(
      new URLSearchParams(
        'section=current&section=past&requestTab=other&campaign=fall&campaign=returning',
      ),
    );

    expect(parsed.selection).toEqual({});
    expect(parsed.canonicalSearchParams.toString()).toBe('campaign=fall&campaign=returning');
    expect(parsed.needsCanonicalization).toBe(true);
  });

  it('serializes explicit selection while preserving unrelated query params', () => {
    const serialized = serializeMatchingRouteQuery(
      new URLSearchParams('section=bad&ref=dashboard&requestTab=received'),
      { section: 'current', requestTab: 'sent' },
    );

    expect(serialized.toString()).toBe('ref=dashboard&section=current&requestTab=sent');
  });

  it('omits owned keys whose selection remains auto', () => {
    const serialized = serializeMatchingRouteQuery(
      new URLSearchParams('section=past&requestTab=received&ref=dashboard'),
      {},
    );

    expect(serialized.toString()).toBe('ref=dashboard');
  });
});
