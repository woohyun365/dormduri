import { Module } from '@nestjs/common';
import { MATCH_PARTICIPANT_WITHDRAWAL_PORT } from '../application/ports/match-participant-withdrawal.port.js';
import { MatchParticipantWithdrawalService } from './match-participant-withdrawal.service.js';

@Module({
  providers: [
    MatchParticipantWithdrawalService,
    {
      provide: MATCH_PARTICIPANT_WITHDRAWAL_PORT,
      useExisting: MatchParticipantWithdrawalService,
    },
  ],
  exports: [MATCH_PARTICIPANT_WITHDRAWAL_PORT],
})
export class MatchLifecycleModule {}
