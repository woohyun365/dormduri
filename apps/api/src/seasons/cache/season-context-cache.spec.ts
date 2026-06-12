import { describe, expect, it, vi } from 'vitest';
import { createSeasonContextCache } from './season-context-cache.js';
import {
  resolveMemoizedCurrentSeasonContext,
  resolveSeasonReferenceNow,
} from './season-context-memoizer.js';

describe('SeasonContextCache', () => {
  it('logical operation 안에서 implicit referenceNow resolver를 한 번만 호출한다', async () => {
    const cache = createSeasonContextCache();
    const referenceNow = new Date('2026-02-10T03:00:00.000Z');
    const resolveReferenceNow = vi.fn<() => Promise<Date>>().mockResolvedValue(referenceNow);

    await expect(resolveSeasonReferenceNow({ cache, resolveReferenceNow })).resolves.toBe(
      referenceNow,
    );
    await expect(resolveSeasonReferenceNow({ cache, resolveReferenceNow })).resolves.toBe(
      referenceNow,
    );

    expect(resolveReferenceNow).toHaveBeenCalledTimes(1);
  });

  it('campusCode + referenceNow 단위로 current season context를 memoize한다', async () => {
    const cache = createSeasonContextCache();
    const referenceNow = new Date('2026-02-10T03:00:00.000Z');
    const load = vi.fn().mockResolvedValue({ context: null, referenceNow });

    await resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode: 'CHUNCHEON',
      referenceNow,
      load,
    });
    await resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode: 'CHUNCHEON',
      referenceNow,
      load,
    });
    await resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode: 'SAMCHEOK',
      referenceNow,
      load,
    });

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('명시적 now가 다르면 같은 cache 안에서도 별도 logical snapshot으로 분리한다', async () => {
    const cache = createSeasonContextCache();
    const firstNow = new Date('2026-02-10T03:00:00.000Z');
    const secondNow = new Date('2026-02-11T03:00:00.000Z');
    const load = vi.fn().mockResolvedValue({ context: null, referenceNow: firstNow });

    await resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode: 'CHUNCHEON',
      referenceNow: firstNow,
      load,
    });
    await resolveMemoizedCurrentSeasonContext({
      cache,
      campusCode: 'CHUNCHEON',
      referenceNow: secondNow,
      load,
    });

    expect(load).toHaveBeenCalledTimes(2);
  });
});
