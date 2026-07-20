import { z } from 'zod';
import { isoDateTimeStringSchema } from '../../date/primitives.js';
import {
  activeMatchEndReasonSchema,
  matchRequestTerminalReasonSchema,
  requestDirectionSchema,
} from './enums.js';
import {
  matchHistoryEntryResultSchema,
  matchHistoryStageSchema,
  matchHistorySystemCancellationCauseSchema,
} from './history.js';

/**
 * 현재 시즌 source row를 사용자-facing 활동 이력으로 축소한 projection이다.
 * 종료 시즌 archive와 같은 result vocabulary를 쓰지만 materialized history row는 아니다.
 */
export const currentMatchActivityEntrySchema = z.strictObject({
  id: z.string(),
  counterpartParticipantId: z.string(),
  counterpartNickname: z.string(),
  stage: matchHistoryStageSchema,
  result: matchHistoryEntryResultSchema,
  direction: requestDirectionSchema,
  occurredAt: isoDateTimeStringSchema,
  requestTerminalReason: matchRequestTerminalReasonSchema.nullable(),
  systemCancellationCause: matchHistorySystemCancellationCauseSchema.nullable(),
  systemCancellationGroupId: z.string().nullable(),
  activeMatchEndReason: activeMatchEndReasonSchema.nullable(),
});

export type CurrentMatchActivityEntry = z.infer<typeof currentMatchActivityEntrySchema>;
