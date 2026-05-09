import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { usersErrors } from './users.errors.js';
import type { UserWithProfileRecord } from '../profiles/profile.mapper.js';
import { resolveCampusServiceState } from './service-state.js';

interface UserSelectionUpdateOwnerDeps {
  prisma: PrismaService;
  seasonParticipantsService: SeasonParticipantsService;
}

export function createUserSelectionUpdateOwner(deps: UserSelectionUpdateOwnerDeps) {
  function assertSelectionPayload(selection: {
    state: 'UNASSIGNED' | 'ASSIGNED';
    dormitoryId: string | null;
  }) {
    if (selection.state === 'ASSIGNED' && !selection.dormitoryId) {
      throw usersErrors.invalidPatch(
        'ASSIGNED 선택에는 dormitoryId가 필요합니다.',
        'selection.dormitoryId',
      );
    }

    if (selection.state === 'UNASSIGNED' && selection.dormitoryId !== null) {
      throw usersErrors.invalidPatch(
        'UNASSIGNED 선택에는 dormitoryId가 없어야 합니다.',
        'selection.dormitoryId',
      );
    }
  }

  async function applySelectionUpdate(
    user: UserWithProfileRecord,
    currentParticipant: Awaited<
      ReturnType<SeasonParticipantsService['ensureCurrentSeasonParticipantForUser']>
    >,
    serviceState: Awaited<ReturnType<typeof resolveCampusServiceState>>,
    now: Date,
    selection: { state: 'UNASSIGNED' | 'ASSIGNED'; dormitoryId: string | null },
    userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    },
    seasonParticipantUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
      participantStatus?: 'DRAFT' | 'ACTIVE';
      activatedAt?: Date | null;
    },
  ) {
    if (!serviceState.campusOperated || serviceState.seasonState === null) {
      throw usersErrors.dormitorySelectionNotAllowed();
    }

    if (
      serviceState.seasonState === 'OFF_SEASON' ||
      serviceState.seasonState === 'SEASON_POST_MATCH' ||
      !serviceState.seasonContext
    ) {
      throw usersErrors.dormitorySelectionNotAllowed();
    }

    if (!currentParticipant || !isParticipantRegistered(currentParticipant)) {
      throw usersErrors.dormitorySelectionRequiresParticipation();
    }

    const canonicalSelection = deps.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );

    if (canonicalSelection.dormitorySelectionState === 'ASSIGNED') {
      throw usersErrors.dormitoryAlreadyConfirmed();
    }

    if (selection.state === 'UNASSIGNED') {
      if (serviceState.seasonState !== 'SEASON_OPEN') {
        throw usersErrors.dormitorySelectionNotAllowed();
      }

      if (
        canonicalSelection.dormitorySelectionState === 'UNASSIGNED' &&
        canonicalSelection.dormitoryId === null
      ) {
        return;
      }

      userUpdateData.dormitorySelectionState = 'UNASSIGNED';
      userUpdateData.dormitoryId = null;
      seasonParticipantUpdateData.dormitorySelectionState = 'UNASSIGNED';
      seasonParticipantUpdateData.dormitoryId = null;
      seasonParticipantUpdateData.participantStatus = 'DRAFT';
      seasonParticipantUpdateData.activatedAt = null;
      return;
    }

    const operatedDormitory = serviceState.seasonContext.operatedDormitories.find(
      (item) => item.dormitoryId === selection.dormitoryId,
    );

    if (!operatedDormitory) {
      throw usersErrors.invalidDormitoryForUser('현재 시즌에서 선택할 수 없는 기숙사입니다.');
    }

    if (
      serviceState.seasonState === 'SEASON_MATCHING' &&
      formatKstDate(now) > operatedDormitory.roomSelectionDate
    ) {
      throw usersErrors.invalidDormitoryForUser('이미 매칭 마감일이 지난 기숙사입니다.');
    }

    const dormitory = await deps.prisma.dormitory.findUnique({
      where: { id: selection.dormitoryId ?? undefined },
      select: {
        id: true,
        campusCode: true,
        genderPolicy: true,
      },
    });

    if (
      !dormitory ||
      dormitory.campusCode !== user.campus ||
      (dormitory.genderPolicy !== user.gender && dormitory.genderPolicy !== 'BOTH')
    ) {
      throw usersErrors.invalidDormitoryForUser();
    }

    userUpdateData.dormitorySelectionState = 'ASSIGNED';
    userUpdateData.dormitoryId = dormitory.id;
    seasonParticipantUpdateData.dormitorySelectionState = 'ASSIGNED';
    seasonParticipantUpdateData.dormitoryId = dormitory.id;
    seasonParticipantUpdateData.participantStatus = 'ACTIVE';
    seasonParticipantUpdateData.activatedAt = now;
  }

  return {
    assertSelectionPayload,
    applySelectionUpdate,
  };
}
