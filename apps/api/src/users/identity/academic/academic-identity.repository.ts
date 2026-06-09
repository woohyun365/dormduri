import type { UpdateCurrentUserAcademicIdentityRequest } from '@repo/shared/user';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type {
  UserAcademicIdentityRecord,
  UserWithDisplayIdentityRecord,
} from '../../current-user/current-user.select.js';
import { usersErrors } from '../../errors/users.errors.js';

export interface ParsedAcademicIdentity {
  collegeCode: string;
  birthYear: number;
}

export type AcademicIdentityClient =
  | Pick<
      PrismaService,
      'userAcademicIdentity' | 'seasonParticipantProfileHistory' | 'seasonParticipant'
    >
  | Pick<
      Prisma.TransactionClient,
      'userAcademicIdentity' | 'seasonParticipantProfileHistory' | 'seasonParticipant'
    >;

export function parseAcademicIdentity(
  input: UpdateCurrentUserAcademicIdentityRequest,
): ParsedAcademicIdentity {
  return {
    collegeCode: input.collegeCode,
    birthYear: input.birthYear,
  };
}

export function assertAcademicIdentity(
  academicIdentity: UserWithDisplayIdentityRecord['academicIdentity'],
): UserAcademicIdentityRecord {
  if (!academicIdentity) {
    throw new Error('[UsersService] user academic identity row is required');
  }
  return academicIdentity;
}

export function isSameAcademicIdentity(
  academicIdentity: UserAcademicIdentityRecord,
  parsedAcademicIdentity: ParsedAcademicIdentity,
) {
  return (
    academicIdentity.collegeCode === parsedAcademicIdentity.collegeCode &&
    academicIdentity.birthYear === parsedAcademicIdentity.birthYear
  );
}

export async function assertBirthYearEditableBeforeRegistration(
  client: AcademicIdentityClient,
  userId: string,
) {
  const participantRows = await client.seasonParticipant.findMany({
    where: { userId },
    select: { id: true },
  });
  if (participantRows.length === 0) {
    return;
  }

  const registrationSnapshot = await client.seasonParticipantProfileHistory.findFirst({
    where: {
      source: 'SEASON_REGISTRATION',
      participantId: { in: participantRows.map((participant) => participant.id) },
    },
    select: { id: true },
  });

  if (registrationSnapshot) {
    throw usersErrors.academicBirthYearLockedAfterRegistration();
  }
}

export async function updateAcademicIdentity(
  client: AcademicIdentityClient,
  input: {
    userId: string;
    parsedAcademicIdentity: ParsedAcademicIdentity;
  },
) {
  await client.userAcademicIdentity.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      collegeCode: input.parsedAcademicIdentity.collegeCode,
      birthYear: input.parsedAcademicIdentity.birthYear,
    },
    update: {
      collegeCode: input.parsedAcademicIdentity.collegeCode,
      birthYear: input.parsedAcademicIdentity.birthYear,
    },
  });
}
