import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOCK_NOTE_MAX_LENGTH,
  blockListResponseSchema,
  createBlockRequestSchema,
  listBlocksQuerySchema,
  NO_BLOCKS,
} from '@repo/shared/social-safety/block';

const serverTime = '2026-06-08T00:00:00.000Z';
const workspaceRoot = join(process.cwd(), '../..');
const sharedSourceRoot = join(workspaceRoot, 'packages/shared/src');

function readOptional(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('block shared contract', () => {
  it('defines block request/query/response contracts with note ownership and coarse visibility', () => {
    const blockContractPath = join(sharedSourceRoot, 'social-safety/block.ts');
    const source = readOptional(blockContractPath);
    const requiredSymbols = [
      'CreateBlockRequest',
      'DeleteBlockRequest',
      'ListBlocksQuery',
      'BlockListResponse',
      'CreateBlockResponse',
      'DeleteBlockResponse',
      'BLOCK_NOTE_MAX_LENGTH',
      'NO_BLOCKS',
      'NO_LONGER_VISIBLE',
    ];
    const forbiddenSymbols = [
      'blockedByCounterpart',
      'hiddenReasonCode',
      'hiddenReasonDetail',
      'targetNotifiedAt',
      'retainedVaultPayload',
    ];

    expect({
      exists: existsSync(blockContractPath),
      missingSymbols: requiredSymbols.filter((symbol) => !source.includes(symbol)),
      forbiddenSymbolsPresent: forbiddenSymbols.filter((symbol) => source.includes(symbol)),
    }).toEqual({
      exists: true,
      missingSymbols: [],
      forbiddenSymbolsPresent: [],
    });
  });

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
