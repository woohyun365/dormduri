import { describe, expect, it, vi } from 'vitest';
import {
  assertBirthYearEditableBeforeRegistration,
  updateAcademicIdentity,
} from './academic-identity.repository.js';
import { usersErrors } from '../../errors/users.errors.js';

function createClient() {
  return {
    userAcademicIdentity: {
      upsert: vi.fn(),
    },
    seasonParticipant: {
      findMany: vi.fn(),
    },
    seasonParticipantProfileHistory: {
      findFirst: vi.fn(),
    },
  };
}

describe('academic identity repository', () => {
  it('registration snapshot이 없으면 birthYear self correction을 허용한다', async () => {
    const client = createClient();
    client.seasonParticipant.findMany.mockResolvedValue([]);

    await expect(
      assertBirthYearEditableBeforeRegistration(client as never, 'user-1'),
    ).resolves.toBeUndefined();

    expect(client.seasonParticipantProfileHistory.findFirst).not.toHaveBeenCalled();
  });

  it('과거 registration snapshot이 있으면 current season이 없어도 birthYear self correction을 막는다', async () => {
    const client = createClient();
    client.seasonParticipant.findMany.mockResolvedValue([{ id: 'participant-1' }]);
    client.seasonParticipantProfileHistory.findFirst.mockResolvedValue({ id: 'history-1' });

    await expect(
      assertBirthYearEditableBeforeRegistration(client as never, 'user-1'),
    ).rejects.toMatchObject({
      response: usersErrors.academicBirthYearLockedAfterRegistration().getResponse(),
    });

    expect(client.seasonParticipantProfileHistory.findFirst).toHaveBeenCalledWith({
      where: {
        source: 'SEASON_REGISTRATION',
        participantId: { in: ['participant-1'] },
      },
      select: { id: true },
    });
  });

  it('academic identity persistence는 upsert shape를 유지한다', async () => {
    const client = createClient();

    await updateAcademicIdentity(client as never, {
      userId: 'user-1',
      parsedAcademicIdentity: {
        collegeCode: 'CHUNCHEON_BUSINESS',
        birthYear: 2001,
      },
    });

    expect(client.userAcademicIdentity.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        collegeCode: 'CHUNCHEON_BUSINESS',
        birthYear: 2001,
      },
      update: {
        collegeCode: 'CHUNCHEON_BUSINESS',
        birthYear: 2001,
      },
    });
  });
});
