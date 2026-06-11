import { buildSeasonParticipantLifecycleMetadataForTest } from './season-participant-lifecycle-event.writer.js';

describe('season-participant-lifecycle-event.writer', () => {
  it('metadata mapper는 allowlist key만 보존하고 raw profile/lifestyle/PII/internal payload를 버린다', () => {
    const metadata = buildSeasonParticipantLifecycleMetadataForTest({
      transitionOwner: 'registration.finalize',
      previousStatus: 'DRAFT',
      nextStatus: 'ACTIVE',
      previousIntent: 'UNDECIDED',
      nextIntent: 'REGISTERED',
      previousDormitoryId: null,
      nextDormitoryId: 'dasan',
      selectionState: 'ASSIGNED',
      canceledPendingMatchRequests: 0,
      chatThreadsMarkedReadOnly: 1,
      profile: { intro: 'raw profile body' },
      lifestyle: { bedtime: '22_24' },
      internalAudit: { stack: 'stack trace' },
      stack: 'Error: secret stack',
      email: 'user@example.com',
      token: 'secret-token',
    });

    expect(metadata).toEqual({
      transitionOwner: 'registration.finalize',
      previousStatus: 'DRAFT',
      nextStatus: 'ACTIVE',
      previousIntent: 'UNDECIDED',
      nextIntent: 'REGISTERED',
      previousDormitoryId: null,
      nextDormitoryId: 'dasan',
      selectionState: 'ASSIGNED',
      canceledPendingMatchRequests: 0,
      chatThreadsMarkedReadOnly: 1,
    });
    expect(metadata).not.toHaveProperty('profile');
    expect(metadata).not.toHaveProperty('lifestyle');
    expect(metadata).not.toHaveProperty('internalAudit');
    expect(metadata).not.toHaveProperty('stack');
    expect(metadata).not.toHaveProperty('email');
    expect(metadata).not.toHaveProperty('token');
  });
});
