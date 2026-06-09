import type { UpdateCurrentUserAcademicIdentityMutationResult } from '@repo/shared/user';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../../seasons/ports/season-context.port.js';
import type { UserWithDisplayIdentityRecord } from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';
import { consumeAcademicCollegeChangeAllowanceTx } from './academic-college-change-allowance.repository.js';
import { recordAcademicIdentityChangeAuditTx } from './academic-identity-audit.repository.js';
import {
  assertAcademicIdentity,
  assertBirthYearEditableBeforeRegistration,
  isSameAcademicIdentity,
  parseAcademicIdentity,
  updateAcademicIdentity,
  type ParsedAcademicIdentity,
} from './academic-identity.repository.js';
import { resolveCurrentRegistrationLockPolicy } from './current-registration-lock.policy.js';

export interface UpdateAcademicIdentityCommandDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
}

export function createUpdateAcademicIdentityCommand(deps: UpdateAcademicIdentityCommandDeps) {
  async function applyAcademicIdentityChange(
    txUser: UserWithDisplayIdentityRecord,
    parsedAcademicIdentity: ParsedAcademicIdentity,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<UpdateCurrentUserAcademicIdentityMutationResult> {
    const academicIdentity = assertAcademicIdentity(txUser.academicIdentity);

    if (isSameAcademicIdentity(academicIdentity, parsedAcademicIdentity)) {
      return {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_ACADEMIC_IDENTITY',
      };
    }

    const registrationLockPolicy = await resolveCurrentRegistrationLockPolicy(
      {
        prisma: deps.prisma,
        seasonsService: deps.seasonsService,
      },
      txUser,
      now,
      tx,
    );
    if (registrationLockPolicy.nicknameLockedBySeason) {
      throw usersErrors.academicIdentityLockedByRegistration();
    }

    const collegeChanged = academicIdentity.collegeCode !== parsedAcademicIdentity.collegeCode;
    const birthYearChanged = academicIdentity.birthYear !== parsedAcademicIdentity.birthYear;

    if (birthYearChanged) {
      await assertBirthYearEditableBeforeRegistration(tx, txUser.id);
    }
    if (collegeChanged) {
      await consumeAcademicCollegeChangeAllowanceTx(tx, {
        userId: txUser.id,
        campus: txUser.campus,
        now,
      });
    }

    await updateAcademicIdentity(tx, {
      userId: txUser.id,
      parsedAcademicIdentity,
    });
    await recordAcademicIdentityChangeAuditTx(tx, {
      userId: txUser.id,
      reason: birthYearChanged ? 'USER_CORRECTION' : 'ACADEMIC_CYCLE_ALLOWANCE',
      actorType: 'USER',
      actorId: txUser.id,
      previousCollegeCode: academicIdentity.collegeCode,
      nextCollegeCode: parsedAcademicIdentity.collegeCode,
      previousBirthYear: academicIdentity.birthYear,
      nextBirthYear: parsedAcademicIdentity.birthYear,
      changedAt: now,
    });

    return {
      attempted: true,
      changed: true,
      noOpReason: null,
    };
  }

  return {
    parseAcademicIdentity,
    applyAcademicIdentityChange,
  };
}
