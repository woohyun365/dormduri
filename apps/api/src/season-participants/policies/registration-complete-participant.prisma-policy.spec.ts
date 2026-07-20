import { describe, expect, it } from 'vitest';
import { buildRegistrationCompleteParticipantWhere } from './registration-complete-participant.prisma-policy.js';

describe('registration complete participant prisma policy', () => {
  it('draft/selection-only row를 등록 aggregate에 포함하지 않는 canonical 조건을 만든다', () => {
    const where = buildRegistrationCompleteParticipantWhere({
      seasonId: 'season-1',
      registrationSnapshotParticipantIds: ['participant-1', 'participant-1'],
    });

    expect(where).toMatchObject({
      seasonId: 'season-1',
      id: { in: ['participant-1'] },
      participationIntent: 'REGISTERED',
      registeredAt: { not: null },
      declinedAt: null,
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: { not: null },
      participantStatus: { in: ['ACTIVE', 'MATCHED'] },
      withdrawnAt: null,
      expiredAt: null,
    });
    expect(where.profile).toMatchObject({
      is: {
        collegeCode: { not: null },
        bedtime: { not: null },
        smokingTolerance: { not: null },
      },
    });
  });
});
