import { CurrentUserQuery } from './current-user.query.js';

const USER_ROW = {
  id: 'user-1',
  email: 'student@kangwon.ac.kr',
  emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
  deletedAt: null,
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
  displayIdentity: {
    userId: 'user-1',
    nickname: '테스터',
    nicknameNormalized: '테스터',
    nicknameChangedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
  academicIdentity: {
    userId: 'user-1',
    collegeCode: 'IT',
    birthYear: 2002,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  },
  dismissedNotices: [],
};

type CurrentUserFindUniqueArgs = {
  where: { id: string };
  select: {
    id: true;
    email: true;
    emailVerifiedAt: true;
    deletedAt: true;
    gender: true;
    campus: true;
    displayIdentity: { select: Record<string, unknown> };
    academicIdentity: { select: Record<string, unknown> };
    dismissedNotices: {
      where: { noticeKey: string };
      take: number;
      select: Record<string, unknown>;
    };
  };
};

describe('CurrentUserQuery', () => {
  const findUnique = jest.fn<Promise<typeof USER_ROW | null>, [CurrentUserFindUniqueArgs]>();
  const prisma = {
    user: { findUnique },
  };
  const query = new CurrentUserQuery(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('current-user read model에 필요한 user/display/academic/onboarding projection만 조회한다', async () => {
    prisma.user.findUnique.mockResolvedValue(USER_ROW);

    await expect(query.getUserWithDisplayIdentity('user-1')).resolves.toEqual(USER_ROW);

    const [findUniqueArgs] = findUnique.mock.calls[0]!;
    expect(findUniqueArgs.where).toEqual({ id: 'user-1' });
    expect(findUniqueArgs.select).toMatchObject({
      id: true,
      email: true,
      emailVerifiedAt: true,
      deletedAt: true,
      gender: true,
      campus: true,
      dismissedNotices: {
        where: { noticeKey: 'service-intro' },
        take: 1,
      },
    });
    expect(findUniqueArgs.select.displayIdentity.select).toHaveProperty('nickname');
    expect(findUniqueArgs.select.academicIdentity.select).toHaveProperty('collegeCode');
    expect(findUniqueArgs.select.dismissedNotices.select).toHaveProperty('dismissedAt');
  });

  it('인증 actor에 대응하는 user row가 없으면 fail-closed 한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(query.getUserWithDisplayIdentity('missing-user')).rejects.toThrow(
      '[CurrentUserViewService] authenticated user not found',
    );
  });
});
