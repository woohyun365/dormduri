import { AuthVerificationService } from './auth-verification.service.js';

describe('AuthVerificationService', () => {
  const prisma = {
    verificationCodeRequestLog: {
      create: jest.fn(),
    },
    moderationTerm: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  };

  const emailSender = {
    sendVerificationCode: jest.fn(),
    sendPasswordResetCode: jest.fn(),
  };

  const service = new AuthVerificationService(prisma as never, emailSender as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(undefined);
  });

  it('signup 완료용 verified code 조회는 verifiedAt proof window를 DB 쿼리로 확인한다', async () => {
    await service.findLatestVerifiedSignupCode('test@kangwon.ac.kr');

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('"verifiedAt" > CURRENT_TIMESTAMP - INTERVAL'),
      'test@kangwon.ac.kr',
    );
  });

  it('signup code 재발급 시 기존 unconsumed signup verification row를 먼저 무효화한다', async () => {
    emailSender.sendVerificationCode.mockResolvedValue(undefined);

    await service.maybeSendSignupCode('test@kangwon.ac.kr', false, '127.0.0.1');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "VerificationCode"'),
      'test@kangwon.ac.kr',
    );
    expect(emailSender.sendVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
  });

  it('reset code는 완화된 600초 TTL을 사용한다', async () => {
    emailSender.sendPasswordResetCode.mockResolvedValue(undefined);

    await service.maybeSendResetCode('test@kangwon.ac.kr', true, '127.0.0.1');

    expect(emailSender.sendPasswordResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 600 }),
    );
  });

  it('reset verified code 조회는 expiresAt을 DB 현재 시각 기준으로 확인한다', async () => {
    await service.findLatestVerifiedResetCode('test@kangwon.ac.kr');

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('"expiresAt" > CURRENT_TIMESTAMP'),
      'test@kangwon.ac.kr',
    );
  });
});
