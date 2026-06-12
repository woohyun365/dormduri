import { Module } from '@nestjs/common';
import { PrismaModule } from '../../platform/database/prisma.module.js';
import { CHAT_THREAD_WITHDRAWAL_PORT } from '../application/ports/chat-thread-withdrawal.port.js';
import { ConversationThreadLifecycleEventRepository } from '../lifecycle-events/conversation-thread-lifecycle-event.repository.js';
import { ConversationThreadLifecycleEventWriter } from '../lifecycle-events/conversation-thread-lifecycle-event.writer.js';
import { ChatParticipantWithdrawalService } from './chat-participant-withdrawal.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    ConversationThreadLifecycleEventRepository,
    ConversationThreadLifecycleEventWriter,
    ChatParticipantWithdrawalService,
    {
      provide: CHAT_THREAD_WITHDRAWAL_PORT,
      useExisting: ChatParticipantWithdrawalService,
    },
  ],
  exports: [CHAT_THREAD_WITHDRAWAL_PORT],
})
export class ChatLifecycleModule {}
