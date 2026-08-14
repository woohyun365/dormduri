import { Injectable } from '@nestjs/common';
import type { VerificationCodePurpose } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  parseVerificationGrant,
  safeCompareVerificationGrantHash,
} from './auth-verification-grant.js';

export interface ResolvedVerificationGrant {
  id: string;
  subjectKey: string;
  purpose: VerificationCodePurpose;
  eligibleUserId: string | null;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class AuthVerificationGrantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    rawGrant: string | null,
    purpose: VerificationCodePurpose,
  ): Promise<ResolvedVerificationGrant | null> {
    const parsed = parseVerificationGrant(rawGrant);
    if (!parsed) {
      return null;
    }

    const [record, databaseNow] = await Promise.all([
      this.prisma.verificationCode.findUnique({
        where: { id: parsed.verificationCodeId },
        select: {
          id: true,
          subjectKey: true,
          purpose: true,
          eligibleUserId: true,
          grantTokenHash: true,
          grantExpiresAt: true,
          verifiedAt: true,
          consumedAt: true,
        },
      }),
      this.prisma.getDatabaseNow(),
    ]);

    if (
      !record ||
      record.purpose !== purpose ||
      !record.verifiedAt ||
      record.consumedAt ||
      !record.grantTokenHash ||
      !record.grantExpiresAt ||
      record.grantExpiresAt <= databaseNow ||
      !safeCompareVerificationGrantHash(record.grantTokenHash, parsed.tokenHash)
    ) {
      return null;
    }

    return {
      id: record.id,
      subjectKey: record.subjectKey,
      purpose: record.purpose,
      eligibleUserId: record.eligibleUserId,
      tokenHash: parsed.tokenHash,
      expiresAt: record.grantExpiresAt,
    };
  }
}
