import { describe, expect, it } from 'vitest';
import {
  BLOCK_NOTE_MAX_LENGTH,
  blockListResponseSchema,
  createBlockRequestSchema,
  listBlocksQuerySchema,
  NO_BLOCKS,
} from '@repo/shared/social-safety/block';

const serverTime = '2026-06-08T00:00:00.000Z';

describe('block shared contract', () => {
  it('block request/query/list response는 note 길이와 probing-safe projection을 고정한다', () => {
    expect(createBlockRequestSchema.parse({ note: '  메모  ' })).toEqual({ note: '메모' });
    expect(() =>
      createBlockRequestSchema.parse({ note: 'x'.repeat(BLOCK_NOTE_MAX_LENGTH + 1) }),
    ).toThrow();
    expect(() => listBlocksQuerySchema.parse({ limit: 51 })).toThrow();
    expect(() => listBlocksQuerySchema.parse({ cursor: '' })).toThrow();

    expect(
      blockListResponseSchema.parse({
        items: [
          {
            id: 'block-1',
            blockedUserId: 'target-user-1',
            blockedAt: serverTime,
            note: '개인 메모',
            visibility: 'NO_LONGER_VISIBLE',
            displayName: null,
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: null,
        serverTime,
      }),
    ).toMatchObject({ items: [{ visibility: 'NO_LONGER_VISIBLE' }] });

    expect(
      blockListResponseSchema.parse({
        items: [],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: { code: NO_BLOCKS },
        serverTime,
      }),
    ).toMatchObject({ emptyState: { code: NO_BLOCKS } });

    expect(() =>
      blockListResponseSchema.parse({
        items: [
          {
            id: 'block-1',
            blockedUserId: 'target-user-1',
            blockedAt: serverTime,
            note: null,
            visibility: 'VISIBLE',
            displayName: '룸메',
            hiddenReasonCode: 'SAFETY_REVIEW',
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
        emptyState: null,
        serverTime,
      }),
    ).toThrow();
  });
});
