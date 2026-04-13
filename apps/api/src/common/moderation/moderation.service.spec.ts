import { ModerationService } from './moderation.service.js';

describe('ModerationService', () => {
  const prisma = {
    moderationTerm: {
      findMany: jest.fn(),
    },
  };

  const service = new ModerationService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
