import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { CHAT_THREAD_WITHDRAWAL_PORT } from '../application/ports/chat-thread-withdrawal.port.js';
import { ChatParticipantWithdrawalService } from './chat-participant-withdrawal.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    ChatParticipantWithdrawalService,
    {
      provide: CHAT_THREAD_WITHDRAWAL_PORT,
      useExisting: ChatParticipantWithdrawalService,
    },
  ],
  exports: [CHAT_THREAD_WITHDRAWAL_PORT],
})
export class ChatLifecycleModule {}
