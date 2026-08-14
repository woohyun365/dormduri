import { describe, expect, it, vi } from 'vitest';
import { SeasonProfileIntroModerationAdapter } from './season-profile-intro-moderation.adapter.js';

describe('SeasonProfileIntroModerationAdapter', () => {
  it('빈 자기소개는 repository-backed moderation 조회 없이 정규화한다', async () => {
    const moderationService = {
      moderatePublicText: vi.fn(),
    };
    const adapter = new SeasonProfileIntroModerationAdapter(moderationService as never);

    await expect(adapter.moderateSeasonProfileIntro('   ')).resolves.toBe('');
    expect(moderationService.moderatePublicText).not.toHaveBeenCalled();
  });

  it('허용된 자기소개는 trim한 값으로 저장 경계에 반환한다', async () => {
    const moderationService = {
      moderatePublicText: vi.fn().mockResolvedValue({ ok: true }),
    };
    const adapter = new SeasonProfileIntroModerationAdapter(moderationService as never);

    await expect(adapter.moderateSeasonProfileIntro('  조용한 생활을 선호해요  ')).resolves.toBe(
      '조용한 생활을 선호해요',
    );
    expect(moderationService.moderatePublicText).toHaveBeenCalledWith(
      '조용한 생활을 선호해요',
      'intro',
    );
  });

  it('차단된 자기소개는 field error가 있는 422 domain error로 매핑한다', async () => {
    const moderationService = {
      moderatePublicText: vi.fn().mockResolvedValue({
        ok: false,
        error: '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.',
      }),
    };
    const adapter = new SeasonProfileIntroModerationAdapter(moderationService as never);

    await expect(adapter.moderateSeasonProfileIntro('한남충새끼들 뒤져라')).rejects.toMatchObject({
      response: {
        code: 'SEASON_PROFILE_INTRO_MODERATION_REJECTED',
        error: '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.',
        fieldErrors: {
          intro: ['자기소개에 사용할 수 없는 표현이 포함되어 있습니다.'],
        },
      },
    });
  });
});
