import { ModerationService } from './moderation.service.js';

describe('ModerationService', () => {
  const prisma = {
    moderationTerm: {
      findMany: jest.fn(),
    },
  };

  let service: ModerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModerationService(prisma as never);
  });

  it('닉네임 금지어를 DB source-of-truth로 차단한다', async () => {
    prisma.moderationTerm.findMany.mockResolvedValue([
      {
        normalizedTerm: '섹스',
        matchMode: 'INCLUDES',
        category: 'BLOCKED_TEXT',
      },
    ]);

    await expect(service.validateNicknamePolicy('섹스장인')).resolves.toBe(
      '사용할 수 없는 표현이 포함되어 있습니다.',
    );
  });

  it('영문 예약어는 exact match만 차단한다', async () => {
    prisma.moderationTerm.findMany.mockResolvedValue([
      {
        normalizedTerm: 'test',
        matchMode: 'EXACT',
        category: 'RESERVED_NICKNAME',
      },
    ]);

    await expect(service.validateNicknamePolicy('greatest')).resolves.toBeNull();
  });

  it('탈퇴/비식별/예외 표시용 reserved nickname은 사용자 닉네임으로 차단한다', async () => {
    prisma.moderationTerm.findMany.mockResolvedValue([
      {
        normalizedTerm: '탈퇴한사용자',
        matchMode: 'INCLUDES',
        category: 'RESERVED_NICKNAME',
      },
      {
        normalizedTerm: '프로필확인불가',
        matchMode: 'INCLUDES',
        category: 'RESERVED_NICKNAME',
      },
    ]);

    await expect(service.validateNicknamePolicy('탈퇴한 사용자')).resolves.toBe(
      '사용할 수 없는 단어가 포함되어 있습니다.',
    );
    await expect(service.validateNicknamePolicy('프로필-확인_불가')).resolves.toBe(
      '사용할 수 없는 단어가 포함되어 있습니다.',
    );
  });
});
