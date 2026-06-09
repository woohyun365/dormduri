import type { PrismaService } from '../../platform/database/prisma.service.js';
import { createRetentionAccessLog } from '../access-logs/create-retention-access-log.command.js';
import {
  decryptRetainedIdentifierPayload,
  resolveRetainedIdentityCipher,
} from './retained-identity-cipher.js';
import type {
  RetainedIdentityDisclosure,
  RetainedIdentityDisclosureInput,
  RetainedIdentityOwnerOptions,
} from './retained-identity.types.js';

export async function discloseRetainedIdentityIdentifiers(
  prisma: Pick<PrismaService, 'retainedIdentity' | 'retentionAccessLog'> &
    Partial<Pick<PrismaService, 'retentionReviewJob'>>,
  input: RetainedIdentityDisclosureInput,
  options: RetainedIdentityOwnerOptions = {},
): Promise<RetainedIdentityDisclosure> {
  assertDisclosureInput(input);

  const now = input.now ?? new Date();
  const retainedIdentity = await prisma.retainedIdentity.findUnique({
    where: { id: input.retainedIdentityId },
    select: {
      id: true,
      encryptedIdentifierPayload: true,
      retentionDisposedAt: true,
    },
  });

  if (!retainedIdentity) {
    throw new Error('[retained-identity-owner] retained identity not found');
  }

  const deniedLogInput = {
    retainedIdentityId: retainedIdentity.id,
    accessedBy: input.accessedBy,
    accessReason: input.accessReason,
    approvalReference: input.approvalReference,
    purpose: input.purpose,
    createdAt: now,
  };

  if (retainedIdentity.retentionDisposedAt) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-identity-owner] retained identity identifiers disposed');
  }

  const cipher = resolveRetainedIdentityCipher(options.identifierCipher);
  if (!cipher || !retainedIdentity.encryptedIdentifierPayload) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-identity-owner] retained identity disclosure key unavailable');
  }

  try {
    const identifiers = decryptRetainedIdentifierPayload(
      cipher,
      retainedIdentity.encryptedIdentifierPayload,
    );
    await createRetentionAccessLog(prisma, {
      retainedIdentityId: retainedIdentity.id,
      targetType: 'IDENTITY_ANCHOR',
      accessedBy: input.accessedBy,
      accessReason: input.accessReason,
      approvalReference: input.approvalReference,
      purpose: input.purpose,
      result: 'DISCLOSED',
      disclosedFields: ['originalUserId', 'email', 'emailNormalized'],
      createdAt: now,
    });

    return {
      retainedIdentityId: retainedIdentity.id,
      originalUserId: identifiers.originalUserId,
      email: identifiers.email,
      emailNormalized: identifiers.emailNormalized,
      keyVersion: cipher.keyVersion,
      disclosedAt: now,
    };
  } catch (error) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw error;
  }
}

function assertDisclosureInput(input: RetainedIdentityDisclosureInput) {
  if (!input.accessedBy.trim()) {
    throw new Error('[retained-identity-owner] accessedBy is required');
  }
  if (!input.approvalReference.trim()) {
    throw new Error('[retained-identity-owner] approvalReference is required');
  }
  if (!input.purpose.trim()) {
    throw new Error('[retained-identity-owner] purpose is required');
  }
}
