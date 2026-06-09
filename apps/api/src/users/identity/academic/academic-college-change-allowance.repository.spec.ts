import { consumeAcademicCollegeChangeAllowanceTx } from './academic-college-change-allowance.repository.js';
import { usersErrors } from '../../users.errors.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');

type AllowanceUpsertArgs = {
  where: { userId: string };
  create: {
    userId: string;
    academicYear: number;
    collegeChangeRemaining: number;
    resetReason: string;
  };
  update: {
    academicYear: number;
    collegeChangeRemaining: number;
    resetReason: string;
  };
};

function createClient() {
  return {
    season: {
      findFirst: jest.fn(),
    },
    userAcademicIdentityChangeAllowance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

describe('academic college change allowance repository', () => {
  it('allowance row가 없으면 current cycle row를 lazy create 후 원자 차감한다', async () => {
    const client = createClient();
    client.season.findFirst.mockResolvedValue({ academicYear: 2026 });
    client.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue(null);
    client.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 1 });

    await consumeAcademicCollegeChangeAllowanceTx(client as never, {
      userId: 'user-1',
      campus: 'CHUNCHEON',
      now: NOW,
    });

    expect(client.userAcademicIdentityChangeAllowance.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      },
      update: {
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      },
    });
    expect(client.userAcademicIdentityChangeAllowance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: { gt: 0 },
      },
      data: { collegeChangeRemaining: { decrement: 1 } },
    });
  });

  it('이전 academic cycle row는 current cycle로 rollover 후 차감한다', async () => {
    const client = createClient();
    client.season.findFirst.mockResolvedValue({ academicYear: 2026 });
    client.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      academicYear: 2025,
      collegeChangeRemaining: 0,
    });
    client.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 1 });

    await consumeAcademicCollegeChangeAllowanceTx(client as never, {
      userId: 'user-1',
      campus: 'CHUNCHEON',
      now: NOW,
    });

    const upsertMock = client.userAcademicIdentityChangeAllowance.upsert as jest.Mock<
      unknown,
      [AllowanceUpsertArgs]
    >;
    const [upsertArgs] = upsertMock.mock.calls[0]!;
    expect(upsertArgs.update).toEqual({
      academicYear: 2026,
      collegeChangeRemaining: 1,
      resetReason: 'ACADEMIC_CYCLE_ROLLOVER',
    });
  });

  it('current/upcoming season academicYear가 없으면 calendar fallback 없이 fail-closed한다', async () => {
    const client = createClient();
    client.season.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      consumeAcademicCollegeChangeAllowanceTx(client as never, {
        userId: 'user-1',
        campus: 'CHUNCHEON',
        now: NOW,
      }),
    ).rejects.toMatchObject({
      response: usersErrors.academicCorrectionCycleUnavailable().getResponse(),
    });

    expect(client.userAcademicIdentityChangeAllowance.findUnique).not.toHaveBeenCalled();
  });

  it('remaining allowance가 없으면 update 없이 exhausted로 fail-closed한다', async () => {
    const client = createClient();
    client.season.findFirst.mockResolvedValue({ academicYear: 2026 });
    client.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      academicYear: 2026,
      collegeChangeRemaining: 0,
    });

    await expect(
      consumeAcademicCollegeChangeAllowanceTx(client as never, {
        userId: 'user-1',
        campus: 'CHUNCHEON',
        now: NOW,
      }),
    ).rejects.toMatchObject({
      response: usersErrors.academicCollegeChangeAllowanceExhausted().getResponse(),
    });

    expect(client.userAcademicIdentityChangeAllowance.updateMany).not.toHaveBeenCalled();
  });

  it('atomic decrement race에서 count=0이면 exhausted로 fail-closed한다', async () => {
    const client = createClient();
    client.season.findFirst.mockResolvedValue({ academicYear: 2026 });
    client.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      academicYear: 2026,
      collegeChangeRemaining: 1,
    });
    client.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      consumeAcademicCollegeChangeAllowanceTx(client as never, {
        userId: 'user-1',
        campus: 'CHUNCHEON',
        now: NOW,
      }),
    ).rejects.toMatchObject({
      response: usersErrors.academicCollegeChangeAllowanceExhausted().getResponse(),
    });
  });
});
