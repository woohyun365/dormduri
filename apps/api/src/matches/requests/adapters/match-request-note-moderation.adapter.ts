import { Injectable } from '@nestjs/common';
import type { CreateMatchRequestRequest } from '@repo/shared/match/contract';
import { ModerationService } from '../../../moderation/moderation.service.js';
import { matchesErrors } from '../../errors/matches.errors.js';
import type { MatchRequestNoteModerationPort } from '../ports/match-request-note-moderation.port.js';

@Injectable()
export class MatchRequestNoteModerationAdapter implements MatchRequestNoteModerationPort {
  constructor(private readonly moderationService: ModerationService) {}

  async moderateMatchRequestNote(note: CreateMatchRequestRequest['note']) {
    const trimmedNote = note?.trim() ? note.trim() : null;
    if (!trimmedNote) {
      return null;
    }

    const moderation = await this.moderationService.moderatePublicText(
      trimmedNote,
      'matchRequestNote',
    );
    if (!moderation.ok) {
      throw matchesErrors.requestNoteModerationRejected(moderation.error);
    }

    return trimmedNote;
  }
}
