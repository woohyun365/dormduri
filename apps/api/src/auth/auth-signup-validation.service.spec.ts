import { AuthSignupValidationService } from './auth-signup-validation.service.js';

describe('AuthSignupValidationService', () => {
  const prisma = {
    userDisplayIdentity: {
      findUnique: jest.fn(),
    },
  };

  const moderationService = {
    validateNicknamePolicy: jest.fn(),
  };

  const service = new AuthSignupValidationService(prisma as never, moderationService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
  });

  it('금지어 닉네임은 validation 단계에서 차단한다', async () => {
    moderationService.validateNicknamePolicy.mockResolvedValue(
      '사용할 수 없는 표현이 포함되어 있습니다.',
    );

    await expect(
      service.validateDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '섹스',
      }),
    ).resolves.toEqual({
      success: false,
      code: 'AUTH_SIGNUP_VALIDATION_FAILED',
      userActionable: true,
      error: '입력값을 다시 확인해주세요.',
      fieldErrors: { nickname: '사용할 수 없는 표현이 포함되어 있습니다.' },
    });
  });

  it('닉네임 중복은 UserDisplayIdentity nicknameNormalized 기준으로 검사한다', async () => {
    prisma.userDisplayIdentity.findUnique.mockResolvedValue({ userId: 'user-existing' });

    await expect(
      service.validateDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
      }),
    ).resolves.toMatchObject({
      success: false,
      fieldErrors: { nickname: '이미 사용 중인 닉네임입니다.' },
    });

    expect(prisma.userDisplayIdentity.findUnique).toHaveBeenCalledWith({
      where: { nicknameNormalized: '테스터' },
      select: { userId: true },
    });
  });
});
