import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  hasOperatedAssignedDormitory,
} from '../../season-participants/policies/index.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { resolveCampusServiceState } from '../../seasons/runtime/campus-service-state.query.js';
import { parseLifestyleOrNull } from '../contracts/public-profile.presenter.js';
import type { PublicProfileViewerContext } from './public-profile-target.types.js';

interface PublicProfileViewerContextQueryDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  seasonParticipantsService: SeasonParticipantsService;
}

const userForProfileVisibilitySelect = {
  id: true,
  emailVerifiedAt: true,
  gender: true,
  campus: true,
  deletedAt: true,
} as const;

export function createPublicProfileViewerContextQuery(deps: PublicProfileViewerContextQueryDeps) {
  async function loadViewerContext(
    authUser: AuthenticatedUserContext,
    now: Date,
  ): Promise<PublicProfileViewerContext> {
    const viewer = await deps.prisma.user.findUnique({
      where: { id: authUser.id },
      select: userForProfileVisibilitySelect,
    });
    if (!viewer || viewer.deletedAt) {
      throw new Error('[PublicProfileViewerContextQuery] authenticated viewer not found');
    }

    const serviceState = await resolveCampusServiceState(
      deps.prisma,
      deps.seasonsService,
      viewer.campus,
      now,
    );
    const viewerParticipant = await deps.seasonParticipantsService.ensureCurrentSeasonParticipant(
      viewer,
      now,
    );
    const viewerSelection =
      deps.seasonParticipantsService.selectCanonicalSelection(viewerParticipant);
    const operatedDormitoryIds = new Set(
      serviceState.seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );
    const viewerLifestyle = parseLifestyleOrNull(viewerParticipant?.profile?.lifestyle ?? null);

    return {
      viewer,
      viewerParticipant,
      viewerSelection,
      viewerLifestyle,
      viewerSeasonProfileComplete:
        viewerLifestyle !== null && isSeasonProfileComplete(viewerLifestyle),
      viewerHasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
        operatedDormitoryIds,
        viewerSelection.dormitorySelectionState,
        viewerSelection.dormitoryId,
      ),
      currentSeasonId: serviceState.seasonContext?.season.id ?? null,
      seasonReferenceYear: resolveSeasonReferenceYear(
        serviceState.seasonContext?.season.seasonEndDate,
      ),
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
      operatedDormitoryIds,
      currentDormitoryCanMatch: canCurrentDormitoryMatch(
        serviceState.seasonContext,
        viewerSelection.dormitoryId,
        now,
      ),
    };
  }

  return { loadViewerContext };
}

function resolveSeasonReferenceYear(seasonEndDate: string | null | undefined) {
  if (!seasonEndDate) {
    return null;
  }

  const parsed = Number(seasonEndDate.slice(0, 4));
  return Number.isInteger(parsed) ? parsed : null;
}
