import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DisplayIdentityNicknamePolicyError,
  DisplayIdentityNicknamePolicyService,
} from './display-identity-nickname-policy.service.js';

describe('DisplayIdentityNicknamePolicyService', () => {
  const moderationService = { validateNicknamePolicy: vi.fn() };
  const repository = { findNicknameOwner: vi.fn() };
  const service = new DisplayIdentityNicknamePolicyService(
    moderationService as never,
    repository as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    repository.findNicknameOwner.mockResolvedValue(null);
  });

  it('shared parser의 canonical display value와 normalized key를 반환한다', async () => {
    await expect(service.validate('  ＮiceＧuy  ')).resolves.toEqual({
      ok: true,
      value: 'NiceGuy',
      normalized: 'niceguy',
      script: 'LATIN',
    });

    expect(moderationService.validateNicknamePolicy).toHaveBeenCalledWith('NiceGuy');
    expect(repository.findNicknameOwner).toHaveBeenCalledWith('niceguy', undefined);
  });

  it('구조 오류는 moderation과 availability 조회 전에 typed rejection으로 거절한다', async () => {
    await expect(service.validate('안녕hi')).rejects.toMatchObject({
      reason: 'INVALID_FORMAT',
      message: '한글과 영문은 함께 사용할 수 없어요.',
    } satisfies Partial<DisplayIdentityNicknamePolicyError>);

    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
    expect(repository.findNicknameOwner).not.toHaveBeenCalled();
  });

  it('moderation rejection은 availability 조회 전에 typed rejection으로 거절한다', async () => {
    moderationService.validateNicknamePolicy.mockResolvedValue(
      '닉네임에 사용할 수 없는 단어가 포함되어 있어요.',
    );

    await expect(service.validate('금지닉네임')).rejects.toMatchObject({
      reason: 'MODERATION_REJECTED',
    });
    expect(repository.findNicknameOwner).not.toHaveBeenCalled();
  });

  it('다른 user가 normalized nickname을 소유하면 taken으로 거절한다', async () => {
    repository.findNicknameOwner.mockResolvedValue('other-user');

    await expect(service.validate('테스터', { excludeUserId: 'user-1' })).rejects.toMatchObject({
      reason: 'ALREADY_TAKEN',
    });
  });

  it('자기 자신의 normalized nickname은 self-service 검사에서 허용한다', async () => {
    repository.findNicknameOwner.mockResolvedValue('user-1');

    await expect(service.validate('테스터', { excludeUserId: 'user-1' })).resolves.toMatchObject({
      value: '테스터',
      normalized: '테스터',
    });
  });
});
