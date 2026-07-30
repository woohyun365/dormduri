import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  AuthMailKind,
  AuthMailOutboxStatus,
  VerificationCodePurpose,
} from '../../generated/prisma/enums.js';
import { claimAuthMailOutboxEvents } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { acquireTransactionAdvisoryLock } from '../../generated/prisma/sql.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from '../verification/auth-verification-lock.js';
import type { EncryptedAuthMailEnvelope } from './auth-mail-envelope.types.js';

export type ClaimedAuthMailOutboxEvent = {
  id: string;
  mailKind: AuthMailKind;
  verificationCodeId: string | null;
  targetUserId: string | null;
  purpose: VerificationCodePurpose | null;
  payloadCiphertext: Uint8Array | null;
  payloadIv: Uint8Array | null;
  payloadAuthTag: Uint8Array | null;
  keyVersion: string;
  expiresAt: Date;
  attemptCount: number;
};

@Injectable()
export class AuthMailOutboxRepository {
  async appendPasswordChanged(
    tx: Prisma.TransactionClient,
    input: {
      targetUserId: string;
      envelope: EncryptedAuthMailEnvelope;
      now: Date;
      expiresAt: Date;
    },
  ): Promise<void> {
    await tx.authMailOutboxEvent.create({
      data: {
        mailKind: 'PASSWORD_CHANGED',
        targetUserId: input.targetUserId,
        payloadCiphertext: toPrismaBytes(input.envelope.payloadCiphertext),
        payloadIv: toPrismaBytes(input.envelope.payloadIv),
        payloadAuthTag: toPrismaBytes(input.envelope.payloadAuthTag),
        keyVersion: input.envelope.keyVersion,
        availableAt: input.now,
        expiresAt: input.expiresAt,
      },
    });
  }

  async claimBatch(
    prisma: PrismaService,
    input: { limit: number; now: Date; claimLeaseMs: number; lockedBy?: string },
  ): Promise<ClaimedAuthMailOutboxEvent[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const staleLockedBefore = new Date(input.now.getTime() - input.claimLeaseMs);
    const lockedBy = input.lockedBy ?? `auth-mail-dispatcher-${randomUUID()}`;

    return prisma.$queryRawTyped<claimAuthMailOutboxEvents.Result>(
      claimAuthMailOutboxEvents(input.now, staleLockedBefore, lockedBy, safeLimit),
    ) as Promise<ClaimedAuthMailOutboxEvent[]>;
  }

  async markSuperseded(prisma: PrismaService, input: { eventId: string; now: Date }) {
    await prisma.runSerializableTransaction(async (tx) => {
      const event = await tx.authMailOutboxEvent.findUnique({
        where: { id: input.eventId },
        select: { verificationCodeId: true },
      });
      await tx.authMailOutboxEvent.updateMany({
        where: { id: input.eventId, status: 'PROCESSING' },
        data: terminalEventData('SUPERSEDED', input.now),
      });
      if (event?.verificationCodeId) {
        await tx.verificationCode.updateMany({
          where: {
            id: event.verificationCodeId,
            deliveryStatus: 'PENDING',
          },
          data: { deliveryStatus: 'SUPERSEDED', consumedAt: input.now },
        });
      }
    });
  }

  async markAccepted(
    prisma: PrismaService,
    input: { eventId: string; now: Date; providerMessageId: string | null },
  ): Promise<boolean> {
    return prisma.runSerializableTransaction(async (tx) => {
      const event = await tx.authMailOutboxEvent.findUnique({
        where: { id: input.eventId },
        select: {
          status: true,
          verificationCodeId: true,
          purpose: true,
          verificationCode: {
            select: {
              subjectKey: true,
              deliveryStatus: true,
              consumedAt: true,
              codeExpiresAt: true,
            },
          },
        },
      });
      if (!event || event.status !== 'PROCESSING') {
        return false;
      }

      if (event.verificationCodeId && event.purpose && event.verificationCode) {
        await tx.$queryRawTyped(
          acquireTransactionAdvisoryLock(
            VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
            getVerificationCodePurposeLockKey(event.verificationCode.subjectKey, event.purpose),
          ),
        );
        const candidate = await tx.verificationCode.findUnique({
          where: { id: event.verificationCodeId },
          select: {
            subjectKey: true,
            deliveryStatus: true,
            consumedAt: true,
            codeExpiresAt: true,
          },
        });
        if (
          !candidate ||
          candidate.deliveryStatus !== 'PENDING' ||
          candidate.consumedAt ||
          candidate.codeExpiresAt <= input.now
        ) {
          await tx.authMailOutboxEvent.updateMany({
            where: { id: input.eventId, status: 'PROCESSING' },
            data: terminalEventData('SUPERSEDED', input.now),
          });
          return false;
        }

        await tx.verificationCode.updateMany({
          where: {
            subjectKey: candidate.subjectKey,
            purpose: event.purpose,
            deliveryStatus: 'ACCEPTED',
            activatedAt: { not: null },
            consumedAt: null,
            id: { not: event.verificationCodeId },
          },
          data: {
            deliveryStatus: 'SUPERSEDED',
            consumedAt: input.now,
          },
        });
        await tx.verificationCode.update({
          where: { id: event.verificationCodeId },
          data: {
            deliveryStatus: 'ACCEPTED',
            activatedAt: input.now,
            providerCorrelationId: input.providerMessageId,
          },
        });
      }

      await tx.authMailOutboxEvent.update({
        where: { id: input.eventId },
        data: {
          ...terminalEventData('ACCEPTED', input.now),
          providerMessageId: input.providerMessageId,
        },
      });
      return true;
    });
  }

  async markDeliveryFailure(
    prisma: PrismaService,
    input: {
      eventId: string;
      now: Date;
      status: 'FAILED' | 'UNKNOWN';
      providerErrorCategory: string;
    },
  ): Promise<void> {
    await prisma.runSerializableTransaction(async (tx) => {
      const event = await tx.authMailOutboxEvent.findUnique({
        where: { id: input.eventId },
        select: { status: true, verificationCodeId: true },
      });
      if (!event || event.status !== 'PROCESSING') {
        return;
      }
      await tx.authMailOutboxEvent.update({
        where: { id: input.eventId },
        data: {
          ...terminalEventData(input.status, input.now),
          providerErrorCategory: input.providerErrorCategory.slice(0, 100),
        },
      });
      if (event.verificationCodeId) {
        await tx.verificationCode.updateMany({
          where: {
            id: event.verificationCodeId,
            deliveryStatus: 'PENDING',
          },
          data: {
            deliveryStatus: input.status,
            consumedAt: input.now,
          },
        });
      }
    });
  }

  async expirePayloads(prisma: PrismaService, now: Date): Promise<number> {
    const expired = await prisma.authMailOutboxEvent.findMany({
      where: {
        expiresAt: { lte: now },
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { id: true, verificationCodeId: true },
      take: 100,
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    });
    if (expired.length === 0) {
      return 0;
    }
    const eventIds = expired.map((event) => event.id);
    const verificationCodeIds = expired.flatMap((event) =>
      event.verificationCodeId ? [event.verificationCodeId] : [],
    );
    await prisma.runSerializableTransaction(async (tx) => {
      await tx.authMailOutboxEvent.updateMany({
        where: { id: { in: eventIds }, status: { in: ['PENDING', 'PROCESSING'] } },
        data: terminalEventData('SUPERSEDED', now),
      });
      if (verificationCodeIds.length > 0) {
        await tx.verificationCode.updateMany({
          where: { id: { in: verificationCodeIds }, deliveryStatus: 'PENDING' },
          data: { deliveryStatus: 'SUPERSEDED', consumedAt: now },
        });
      }
    });
    return expired.length;
  }
}

function terminalEventData(status: AuthMailOutboxStatus, now: Date) {
  return {
    status,
    payloadCiphertext: null,
    payloadIv: null,
    payloadAuthTag: null,
    lockedAt: null,
    lockedBy: null,
    completedAt: now,
    updatedAt: now,
  };
}

function toPrismaBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}
