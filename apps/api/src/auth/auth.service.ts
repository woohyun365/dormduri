import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { Campus, Gender, VerificationCodePurpose } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
  JWT_ACCESS_TTL_SECONDS,
  LOGIN_LOCKOUT_ATTEMPTS,
  LOGIN_LOCKOUT_TTL_SECONDS,
  RESET_CODE_MIN_RESPONSE_MS,
  VERIFICATION_CODE_TTL_SECONDS,
} from './auth.constants.js';
import { EMAIL_SENDER } from './email-sender.interface.js';
import type { EmailSender } from './email-sender.interface.js';
import type { AuthUserView, GenericSuccessResult, LoginResult } from './auth.types.js';
import {
  ensureMinDuration,
  generateVerificationCode,
  hashVerificationCode,
  isKnuEmail,
  normalizeEmail,
  normalizeNickname,
  validateNicknamePolicy,
  validatePasswordPolicy,
} from './auth.utils.js';
import { validateLifestyleData, type LifestyleData } from './lifestyle.schema.js';
import { apiEnv } from '../config/env.js';

interface SignupInput {
  email: string;
  password: string;
  nickname: string;
  gender: Gender;
  campus: Campus;
  lifestyle: Record<string, unknown>;
  intro: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
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

    if (existingUser) {
      return { success: false, error: '이미 가입된 이메일입니다.' };
    }

    await this.issueVerificationCode(emailNormalized, 'SIGNUP', requestIp);
    return { success: true };
  }

  async sendResetCode(email: string, requestIp: string | null): Promise<GenericSuccessResult> {
    const startedAt = Date.now();
    const emailNormalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    if (user) {
      await this.issueVerificationCode(emailNormalized, 'RESET_PASSWORD', requestIp);
    }

    await ensureMinDuration(startedAt, RESET_CODE_MIN_RESPONSE_MS);

    return { success: true };
  }

  async verifyEmailCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verifyCode(email, 'SIGNUP', code);
  }

  async verifyResetCode(email: string, code: string): Promise<GenericSuccessResult> {
    return this.verifyCode(email, 'RESET_PASSWORD', code);
  }

  async signup(input: SignupInput): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(input.email);
    if (!isKnuEmail(emailNormalized)) {
      return { success: false, error: '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.' };
    }

    const passwordError = validatePasswordPolicy(input.password, input.email);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    const nicknameError = validateNicknamePolicy(input.nickname);
    if (nicknameError) {
      return { success: false, error: nicknameError };
    }

    const lifestyleValidation = validateLifestyleData(input.lifestyle);
    if (!lifestyleValidation.ok) {
      return { success: false, error: lifestyleValidation.error };
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ emailNormalized }, { nicknameNormalized: normalizeNickname(input.nickname) }],
      },
      select: { emailNormalized: true, nicknameNormalized: true },
    });

    if (existingUser?.emailNormalized === emailNormalized) {
      return { success: false, error: '이미 가입된 이메일입니다.' };
    }
    if (existingUser?.nicknameNormalized === normalizeNickname(input.nickname)) {
      return { success: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    const verifiedCode = await this.prisma.verificationCode.findFirst({
      where: {
        emailNormalized,
        purpose: 'SIGNUP',
        verifiedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!verifiedCode) {
      return { success: false, error: '이메일 인증을 먼저 완료해주세요.' };
    }

    const passwordHash = await argonHash(input.password, {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email.trim(),
          emailNormalized,
          passwordHash,
          nickname: input.nickname.trim(),
          nicknameNormalized: normalizeNickname(input.nickname),
          gender: input.gender,
          campus: input.campus,
          intro: input.intro.trim(),
          lifestyle: lifestyleValidation.value,
          emailVerifiedAt: new Date(),
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

    await this.prisma.verificationCode.update({
      where: { id: verifiedCode.id },
      data: { consumedAt: new Date() },
    });

    const authResult = await this.issueAuthResult(user.id, user.email, false);
    return {
      success: true,
      accessToken: authResult.accessToken,
      user: this.toAuthUserView(user),
    };
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(email);
    const attempt = await this.prisma.loginAttempt.findUnique({
      where: { emailNormalized },
    });

    if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
      return {
        success: false,
        locked: true,
        remainingSeconds: Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 1000),
        error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      return this.recordLoginFailure(emailNormalized);
    }

    const passwordMatches = await argonVerify(user.passwordHash, password);
    if (!passwordMatches) {
      return this.recordLoginFailure(emailNormalized);
    }

    await this.prisma.loginAttempt.deleteMany({
      where: { emailNormalized },
    });

    const authResult = await this.issueAuthResult(user.id, user.email, rememberMe);
    return {
      success: true,
      accessToken: authResult.accessToken,
      user: this.toAuthUserView(user),
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

    const verifiedCode = await this.prisma.verificationCode.findFirst({
      where: {
        emailNormalized,
        purpose: 'RESET_PASSWORD',
        verifiedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!verifiedCode) {
      return { success: false, error: '비밀번호 재설정 요청을 다시 진행해주세요.' };
    }

    const passwordHash = await argonHash(newPassword, {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.verificationCode.update({
        where: { id: verifiedCode.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async logout(token: string | null): Promise<GenericSuccessResult> {
    if (!token) {
      return { success: true };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string }>(token, {
        secret: this.getJwtSecret(),
      });
      if (payload.sid) {
        await this.prisma.authSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // clear cookie regardless
    }

    return { success: true };
  }

  private async issueVerificationCode(
    emailNormalized: string,
    purpose: VerificationCodePurpose,
    requestIp: string | null,
  ): Promise<void> {
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(emailNormalized, purpose, code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_SECONDS * 1000);

    await this.prisma.verificationCode.create({
      data: {
        emailNormalized,
        purpose,
        codeHash,
        expiresAt,
        requestIp,
      },
    });

    if (purpose === 'SIGNUP') {
      await this.emailSender.sendVerificationCode({
        email: emailNormalized,
        code,
        expiresInSeconds: VERIFICATION_CODE_TTL_SECONDS,
      });
      return;
    }

    await this.emailSender.sendPasswordResetCode({
      email: emailNormalized,
      code,
      expiresInSeconds: VERIFICATION_CODE_TTL_SECONDS,
    });
  }

  private async verifyCode(
    email: string,
    purpose: VerificationCodePurpose,
    code: string,
  ): Promise<GenericSuccessResult> {
    const emailNormalized = normalizeEmail(email);
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        emailNormalized,
        purpose,
        consumedAt: null,
      },
      orderBy: { issuedAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }

    const incomingHash = hashVerificationCode(emailNormalized, purpose, code);
    if (incomingHash !== record.codeHash) {
      return { success: false, error: '인증 코드가 올바르지 않습니다.' };
    }

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    });

    return { success: true };
  }

  private async issueAuthResult(userId: string, email: string, rememberMe: boolean) {
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        rememberMe,
        expiresAt: new Date(
          Date.now() +
            (rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS) * 1000,
        ),
      },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        sid: session.id,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: JWT_ACCESS_TTL_SECONDS,
      },
    );

    return { accessToken, sessionId: session.id };
  }

  private async recordLoginFailure(emailNormalized: string): Promise<LoginResult> {
    const [attempt] = await this.prisma.$queryRawUnsafe<
      { failureCount: number; lockedUntil: Date | null }[]
    >(
      `
        INSERT INTO "LoginAttempt" (
          id,
          "emailNormalized",
          "failureCount",
          "lockedUntil",
          "lastFailedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1,
          $2,
          1,
          NULL,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT ("emailNormalized")
        DO UPDATE SET
          "failureCount" = "LoginAttempt"."failureCount" + 1,
          "lockedUntil" = CASE
            WHEN "LoginAttempt"."failureCount" + 1 >= ${LOGIN_LOCKOUT_ATTEMPTS}
            THEN NOW() + INTERVAL '${LOGIN_LOCKOUT_TTL_SECONDS} seconds'
            ELSE NULL
          END,
          "lastFailedAt" = NOW(),
          "updatedAt" = NOW()
        RETURNING "failureCount", "lockedUntil"
      `,
      randomUUID(),
      emailNormalized,
    );

    const failureCount = attempt?.failureCount ?? 1;
    const locked = failureCount >= LOGIN_LOCKOUT_ATTEMPTS;

    if (locked) {
      return {
        success: false,
        locked: true,
        remainingSeconds: LOGIN_LOCKOUT_TTL_SECONDS,
        error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
      };
    }

    return {
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
    };
  }

  private toAuthUserView(user: {
    id: string;
    email: string;
    nickname: string;
    gender: Gender;
    campus: Campus;
    lifestyle: Prisma.JsonValue;
    intro: string;
    dormitoryId: string | null;
  }): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      gender: user.gender,
      campus: user.campus,
      lifestyle: user.lifestyle as LifestyleData,
      intro: user.intro,
      dormitoryId: user.dormitoryId,
    };
  }

  private getJwtSecret(): string {
    return apiEnv.jwtSecret;
  }
}
