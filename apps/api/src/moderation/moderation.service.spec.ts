import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModerationService } from './moderation.service.js';

describe('ModerationService', () => {
  const repository = {
    findActiveTerms: vi.fn(),
  };

  let service: ModerationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ModerationService(repository as never);
  });

  it('닉네임 금지어를 DB source-of-truth로 차단한다', async () => {
    repository.findActiveTerms.mockResolvedValue({
      blocked: [
        {
          normalizedTerm: '섹스',
          matchMode: 'INCLUDES',
          term: '섹스',
        },
      ],
      reserved: [],
    });

    await expect(service.validateNicknamePolicy('섹스장인')).resolves.toBe(
      '사용할 수 없는 표현이 포함되어 있습니다.',
    );
  });

  it('동일 surface는 TTL cache를 재사용해 repository 조회를 반복하지 않는다', async () => {
    repository.findActiveTerms.mockResolvedValue({
      blocked: [
        {
          normalizedTerm: '금지어',
          matchMode: 'INCLUDES',
          term: '금지어',
        },
      ],
      reserved: [],
    });

    await expect(service.moderatePublicText('금지어 포함', 'intro')).resolves.toEqual({
      ok: false,
      error: '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.',
    });
    await expect(service.moderatePublicText('금지어 포함', 'intro')).resolves.toEqual({
      ok: false,
      error: '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.',
    });

    expect(repository.findActiveTerms).toHaveBeenCalledTimes(1);
    expect(repository.findActiveTerms).toHaveBeenCalledWith('intro');
  });

  it('영문 예약어는 exact match만 차단한다', async () => {
    repository.findActiveTerms.mockResolvedValue({
      blocked: [],
      reserved: [
        {
          normalizedTerm: 'test',
          matchMode: 'EXACT',
          term: 'test',
        },
      ],
    });

    await expect(service.validateNicknamePolicy('greatest')).resolves.toBeNull();
  });

  it('탈퇴/비식별/예외 표시용 reserved nickname은 사용자 닉네임으로 차단한다', async () => {
    repository.findActiveTerms.mockResolvedValue({
      blocked: [],
      reserved: [
        {
          normalizedTerm: '탈퇴한사용자',
          matchMode: 'INCLUDES',
          term: '탈퇴한사용자',
        },
        {
          normalizedTerm: '프로필확인불가',
          matchMode: 'INCLUDES',
          term: '프로필확인불가',
        },
      ],
    });

    await expect(service.validateNicknamePolicy('탈퇴한 사용자')).resolves.toBe(
      '사용할 수 없는 단어가 포함되어 있습니다.',
    );
    await expect(service.validateNicknamePolicy('프로필-확인_불가')).resolves.toBe(
      '사용할 수 없는 단어가 포함되어 있습니다.',
    );
  });
});
