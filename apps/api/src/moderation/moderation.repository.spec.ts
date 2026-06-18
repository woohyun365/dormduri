import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationRepository } from './moderation.repository.js';

describe('ModerationRepository', () => {
  const prisma = {
    moderationTerm: {
      findMany: vi.fn(),
    },
  };

  let repository: ModerationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ModerationRepository(prisma as never);
  });

  it('active ALL + surface terms를 조회하고 category별 policy entry로 매핑한다', async () => {
    prisma.moderationTerm.findMany.mockResolvedValue([
      {
        normalizedTerm: '금지어',
        matchMode: 'INCLUDES',
        category: 'BLOCKED_TEXT',
      },
      {
        normalizedTerm: 'admin',
        matchMode: 'EXACT',
        category: 'RESERVED_NICKNAME',
      },
    ]);

    await expect(repository.findActiveTerms('nickname')).resolves.toEqual({
      blocked: [
        {
          normalizedTerm: '금지어',
          matchMode: 'INCLUDES',
          term: '금지어',
        },
      ],
      reserved: [
        {
          normalizedTerm: 'admin',
          matchMode: 'EXACT',
          term: 'admin',
        },
      ],
    });
    expect(prisma.moderationTerm.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        surface: { in: ['ALL', 'NICKNAME'] },
      },
      select: {
        normalizedTerm: true,
        matchMode: true,
        category: true,
      },
    });
  });
});
