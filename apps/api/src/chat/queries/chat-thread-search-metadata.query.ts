import { Injectable } from '@nestjs/common';
import { findActiveChatThreadSearchMetadata } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  ChatThreadSearchMetadata,
  ChatThreadSearchMetadataKind,
  ChatThreadSearchMetadataReaderPort,
  ChatThreadSearchMetadataStatus,
} from '../application/ports/chat-thread-search-metadata-reader.port.js';

@Injectable()
export class ChatThreadSearchMetadataQuery implements ChatThreadSearchMetadataReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveThreadMetadata(input: {
    seasonId: string;
    viewerParticipantId: string;
    targetParticipantIds: readonly string[];
  }): Promise<ReadonlyMap<string, ChatThreadSearchMetadata>> {
    const targetParticipantIds = [...new Set(input.targetParticipantIds)];
    if (targetParticipantIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.$queryRawTyped(
      findActiveChatThreadSearchMetadata(
        input.seasonId,
        input.viewerParticipantId,
        targetParticipantIds,
      ),
    );

    const metadata = new Map<string, ChatThreadSearchMetadata>();
    for (const row of rows) {
      if (
        !row.threadId ||
        !row.targetParticipantId ||
        !isChatThreadKind(row.threadKind) ||
        !isOpenChatThreadStatus(row.status)
      ) {
        continue;
      }
      if (metadata.has(row.targetParticipantId)) {
        continue;
      }
      metadata.set(row.targetParticipantId, {
        threadId: row.threadId,
        targetParticipantId: row.targetParticipantId,
        threadKind: row.threadKind,
        status: row.status,
        lastMessageAt: row.lastMessageAt,
      });
    }
    return metadata;
  }
}

function isChatThreadKind(value: string | null): value is ChatThreadSearchMetadataKind {
  return value === 'DIRECT' || value === 'MATCHED';
}

function isOpenChatThreadStatus(value: string | null): value is ChatThreadSearchMetadataStatus {
  return value === 'OPEN';
}
