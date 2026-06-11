export const PARTICIPANT_VISIBILITY_WRITER_PORT = Symbol('PARTICIPANT_VISIBILITY_WRITER_PORT');

export type ParticipantVisibilityProjectionReason =
  | 'POLICY_VIOLATION'
  | 'SAFETY_REVIEW'
  | 'ADMIN_REQUEST'
  | 'OTHER';

export interface ApplyParticipantVisibilityProjectionInput {
  participantId: string;
  reason: ParticipantVisibilityProjectionReason;
  decidedAt: Date;
  actorUserId: string;
  decisionSourceId: string;
}

export interface ClearParticipantVisibilityProjectionInput {
  participantId: string;
  clearedAt: Date;
  actorUserId: string;
  decisionSourceId: string;
}

export interface ParticipantVisibilityWriterPort {
  applyProjection(input: ApplyParticipantVisibilityProjectionInput): Promise<void>;
  clearProjection(input: ClearParticipantVisibilityProjectionInput): Promise<void>;
}
