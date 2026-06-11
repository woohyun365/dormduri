import type { PrismaService } from '../../platform/database/prisma.service.js';
import { createRetainedIdentitySnapshotTx } from './create-retained-identity-snapshot.command.js';
import { discloseRetainedIdentityIdentifiers } from './retained-identity-disclosure.service.js';
import { disposeExpiredRetainedIdentities } from './retained-identity-disposal.service.js';
import type {
  RetainedIdentityDisclosureInput,
  RetainedIdentityOwnerOptions,
  RetainedIdentitySnapshotInput,
} from './retained-identity.types.js';

export function createRetainedIdentityOwner(
  prisma: PrismaService,
  options: RetainedIdentityOwnerOptions = {},
) {
  return {
    async createRetainedIdentitySnapshot(input: RetainedIdentitySnapshotInput) {
      return prisma.runSerializableTransaction(async (tx) => {
        return createRetainedIdentitySnapshotTx(tx, input, options);
      });
    },
    discloseRetainedIdentityIdentifiers(input: RetainedIdentityDisclosureInput) {
      return discloseRetainedIdentityIdentifiers(prisma, input, options);
    },
    disposeExpiredRetainedIdentities(now: Date) {
      return disposeExpiredRetainedIdentities(prisma, now);
    },
  };
}
