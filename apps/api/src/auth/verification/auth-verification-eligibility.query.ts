import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';

@Injectable()
export class AuthVerificationEligibilityQuery {
  constructor(private readonly prisma: PrismaService) {}

  async signupUserExists(emailNormalized: string): Promise<boolean> {
    const existingUser = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    return Boolean(existingUser);
  }

  async passwordResetEligible(emailNormalized: string): Promise<boolean> {
    return Boolean(await this.findPasswordResetEligibleUserId(emailNormalized));
  }

  async findPasswordResetEligibleUserId(emailNormalized: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });

    return user && !user.deletedAt && user.emailVerifiedAt ? user.id : null;
  }
}
