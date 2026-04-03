import { Injectable } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { Prisma } from '../generated/prisma/client.js';
import type { Campus } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type {
  DevAuthUsersResult,
  GenericSuccessResult,
  LoginResult,
  SessionStatusResult,
  SignupInput,
} from './auth.types.js';
import {
  isKnuEmail,
  normalizeEmail,
  normalizeNickname,
  validatePasswordPolicy,
} from './auth.utils.js';
import { validateLifestyleData } from './lifestyle.schema.js';
import { AuthVerificationService } from './auth-verification.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import { toAuthUserView } from './auth-user-view.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { AuthSignupValidationService } from './auth-signup-validation.service.js';
import type { SignupProfileValidationResponse } from '@repo/shared/auth-response';

const DEV_PRESET_LOGIN_PASSWORD = '1q2w3e4r';

const DEV_PRESET_GROUPS = [
  {
    campus: 'CHUNCHEON' as const,
    label: '춘천 (운영중)',
    users: [
      { presetKey: 'chuncheon-M', email: 'test@kangwon.ac.kr' },
      { presetKey: 'chuncheon-F', email: 'test-f@kangwon.ac.kr' },
    ],
  },
  {
    campus: 'SAMCHEOK' as const,
    label: '삼척 (비운영)',
    users: [
      { presetKey: 'samcheok-M', email: 'test-samcheok-m@kangwon.ac.kr' },
      { presetKey: 'samcheok-F', email: 'test-samcheok-f@kangwon.ac.kr' },
    ],
  },
  {
    campus: 'DOGYE' as const,
    label: '도계 (비운영)',
    users: [
      { presetKey: 'dogye-M', email: 'test-dogye-m@kangwon.ac.kr' },
      { presetKey: 'dogye-F', email: 'test-dogye-f@kangwon.ac.kr' },
    ],
  },
] as const satisfies readonly {
  campus: Campus;
  label: string;
  users: readonly { presetKey: string; email: string }[];
}[];

const DEV_PRESET_EMAILS = new Set(
  DEV_PRESET_GROUPS.flatMap((group) => group.users.map((user) => normalizeEmail(user.email))),
);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: AuthVerificationService,
    private readonly sessionService: AuthSessionService,
    private readonly loginAttemptService: AuthLoginAttemptService,
    private readonly moderationService: ModerationService,
    private readonly signupValidationService: AuthSignupValidationService,
  ) {}

  async sendSignupCode(email: string, requestIp: string | null): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    if (!isKnuEmail(emailNormalized)) {
      return { success: false, error: '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.' };
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    return this.verificationService.maybeSendSignupCode(
      emailNormalized,
      Boolean(existingUser),
      requestIp,
    );
  }

  async sendResetCode(email: string, requestIp: string | null): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    return this.verificationService.maybeSendResetCode(emailNormalized, Boolean(user), requestIp);
  }

  async verifyEmailCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verificationService.verifyEmailCode(email, code);
  }

  async verifyResetCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verificationService.verifyResetCode(email, code);
  }

  async getSession(token: string | null): Promise<SessionStatusResult> {
    return this.sessionService.getSession(token);
  }

  async getDevUsers(): Promise<DevAuthUsersResult> {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, error: '개발 환경에서만 사용할 수 있습니다.' };
    }

    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        nickname: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        createdAt: true,
      },
    });

    const byEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));

    return {
      success: true,
      presetGroups: DEV_PRESET_GROUPS.map((group) => ({
        campus: group.campus,
        label: group.label,
        users: group.users
          .map((presetUser) => {
            const user = byEmail.get(normalizeEmail(presetUser.email));
            if (!user) return null;
            return {
              id: user.id,
              email: user.email,
              nickname: user.nickname,
              gender: user.gender,
              campus: user.campus,
              dormitoryId: user.dormitoryId,
              createdAt: user.createdAt.toISOString(),
              presetKey: presetUser.presetKey,
              loginPassword: DEV_PRESET_LOGIN_PASSWORD,
            };
          })
          .filter((user): user is NonNullable<typeof user> => user !== null),
      })),
      users: users
        .filter((user) => !DEV_PRESET_EMAILS.has(normalizeEmail(user.email)))
        .map((user) => ({
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          gender: user.gender,
          campus: user.campus,
          dormitoryId: user.dormitoryId,
          createdAt: user.createdAt.toISOString(),
        })),
    };
  }

  async validateSignupProfileDraft(input: {
    email: string;
    password: string;
    nickname: string;
  }): Promise<SignupProfileValidationResponse> {
    return this.signupValidationService.validateDraft(input);
  }

  async signup(input: SignupInput): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(input.email);
    if (!isKnuEmail(emailNormalized)) {
      return { success: false, error: '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.' };
    }

    const preflight = await this.signupValidationService.validateDraft({
      email: input.email,
      password: input.password,
      nickname: input.nickname,
    });

    if (!preflight.success) {
      return {
        success: false,
        error:
          preflight.errors?.nickname ??
          preflight.errors?.password ??
          preflight.errors?.email ??
          preflight.error,
      };
    }

    const lifestyleValidation = validateLifestyleData(input.lifestyle);
    if (!lifestyleValidation.ok) {
      return { success: false, error: lifestyleValidation.error };
    }

    const introModeration = await this.moderationService.moderatePublicText(input.intro, 'intro');
    if (!introModeration.ok) {
      return { success: false, error: introModeration.error };
    }

    const normalizedNickname = normalizeNickname(input.nickname);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ emailNormalized }, { nicknameNormalized: normalizedNickname }],
      },
      select: { emailNormalized: true, nicknameNormalized: true },
    });

    if (existingUser?.emailNormalized === emailNormalized) {
      return { success: false, error: '이미 가입된 이메일입니다.' };
    }
    if (existingUser?.nicknameNormalized === normalizedNickname) {
      return { success: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    const verifiedCode =
      await this.verificationService.findLatestVerifiedSignupCode(emailNormalized);
    if (!verifiedCode) {
      return { success: false, error: '이메일 인증을 먼저 완료해주세요.' };
    }

    const passwordHash = await this.hashPassword(input.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email.trim(),
          emailNormalized,
          passwordHash,
          nickname: input.nickname.trim(),
          nicknameNormalized: normalizedNickname,
          gender: input.gender,
          campus: input.campus,
          intro: input.intro.trim(),
          lifestyle: lifestyleValidation.value,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';
        if (target.includes('emailNormalized')) {
          return { success: false, error: '이미 가입된 이메일입니다.' };
        }
        if (target.includes('nicknameNormalized')) {
          return { success: false, error: '이미 사용 중인 닉네임입니다.' };
        }
      }
      throw error;
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      user.id,
    );
    await this.verificationService.consumeVerificationCode(verifiedCode.id);

    const authResult = await this.sessionService.issueAuthResult(user.id, user.email, false);
    return {
      success: true,
      accessToken: authResult.accessToken,
      user: toAuthUserView(user),
    };
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(email);
    const activeLock = await this.loginAttemptService.getActiveLock(emailNormalized);
    if (activeLock) {
      return activeLock;
    }

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      return this.loginAttemptService.recordLoginFailure(emailNormalized);
    }

    const passwordMatches = await argonVerify(user.passwordHash, password);
    if (!passwordMatches) {
      return this.loginAttemptService.recordLoginFailure(emailNormalized);
    }

    await this.loginAttemptService.clearFailures(emailNormalized);

    const authResult = await this.sessionService.issueAuthResult(user.id, user.email, rememberMe);
    return {
      success: true,
      accessToken: authResult.accessToken,
      user: toAuthUserView(user),
    };
  }

  async resetPassword(email: string, newPassword: string): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      return { success: false, error: '비밀번호 재설정 요청을 다시 진행해주세요.' };
    }

    const passwordError = validatePasswordPolicy(newPassword, user.email);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    const samePassword = await argonVerify(user.passwordHash, newPassword);
    if (samePassword) {
      return { success: false, error: '현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.' };
    }

    const verifiedCode =
      await this.verificationService.findLatestVerifiedResetCode(emailNormalized);
    if (!verifiedCode) {
      return { success: false, error: '비밀번호 재설정 요청을 다시 진행해주세요.' };
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.$executeRawUnsafe(
        `UPDATE "VerificationCode" SET "consumedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
        verifiedCode.id,
      ),
      this.prisma.$executeRawUnsafe(
        `UPDATE "AuthSession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "revokedAt" IS NULL`,
        user.id,
      ),
    ]);

    return { success: true };
  }

  async logout(token: string | null): Promise<GenericSuccessResult> {
    return this.sessionService.logout(token);
  }

  private async hashPassword(password: string): Promise<string> {
    return argonHash(password, {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }
}
