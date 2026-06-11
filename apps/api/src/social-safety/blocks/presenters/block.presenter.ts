import { Injectable } from '@nestjs/common';
import type {
  BlockListItem,
  BlockListMetadata,
  BlockListResponse,
  CreateBlockResponse,
  DeleteBlockResponse,
} from '@repo/shared/social-safety/block';
import { NO_BLOCKS } from '@repo/shared/social-safety/block';
import { encodeBlockListCursor } from '../queries/block-list.cursor.js';

export interface BlockRecordView {
  id: string;
  blockedUserId: string;
  note: string | null;
  blockedAt: Date;
}

export interface BlockListItemView extends BlockRecordView {
  visibility: BlockListItem['visibility'];
  displayName: string | null;
}

@Injectable()
export class BlockPresenter {
  toCreateResponse(input: {
    block: BlockRecordView;
    created: boolean;
    now: Date;
  }): CreateBlockResponse {
    return {
      block: this.toBlock(input.block),
      created: input.created,
      listMetadata: this.toListMetadata(input.now),
    };
  }

  toDeleteResponse(input: { deleted: boolean; now: Date }): DeleteBlockResponse {
    return {
      deleted: input.deleted,
      listMetadata: this.toListMetadata(input.now),
    };
  }

  toListResponse(input: {
    items: BlockListItemView[];
    activeBlockCount: number;
    hasNextPage: boolean;
    now: Date;
  }): BlockListResponse {
    return {
      items: input.items.map((item) => ({
        id: item.id,
        blockedUserId: item.blockedUserId,
        blockedAt: item.blockedAt.toISOString(),
        note: item.note,
        visibility: item.visibility,
        displayName: item.displayName,
      })),
      pageInfo: {
        hasNextPage: input.hasNextPage,
        nextCursor: input.hasNextPage
          ? encodeBlockListCursor(toCursorPayload(input.items.at(-1)))
          : null,
      },
      emptyState: input.activeBlockCount === 0 ? { code: NO_BLOCKS } : null,
      serverTime: input.now.toISOString(),
    };
  }

  private toBlock(block: BlockRecordView) {
    return {
      id: block.id,
      blockedUserId: block.blockedUserId,
      blockedAt: block.blockedAt.toISOString(),
      note: block.note,
    };
  }

  private toListMetadata(now: Date): BlockListMetadata {
    return { serverTime: now.toISOString() };
  }
}

function toCursorPayload(item: BlockListItemView | undefined) {
  if (!item) {
    throw new Error('[BlockPresenter] next cursor requested without list item');
  }

  return {
    blockedAt: item.blockedAt.toISOString(),
    id: item.id,
  };
}
