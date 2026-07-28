import { Injectable } from '@nestjs/common';
import { ModerationService } from '../../../moderation/moderation.service.js';
import { seasonParticipantsErrors } from '../../errors/season-participants.errors.js';
import type { SeasonProfileIntroModerationPort } from '../ports/season-profile-intro-moderation.port.js';

@Injectable()
export class SeasonProfileIntroModerationAdapter implements SeasonProfileIntroModerationPort {
  constructor(private readonly moderationService: ModerationService) {}

  async moderateSeasonProfileIntro(intro: string): Promise<string> {
    const trimmedIntro = intro.trim();
    if (!trimmedIntro) {
      return '';
    }

    const moderation = await this.moderationService.moderatePublicText(trimmedIntro, 'intro');
    if (!moderation.ok) {
      throw seasonParticipantsErrors.seasonProfileIntroModerationRejected(moderation.error);
    }

    return trimmedIntro;
  }
}
