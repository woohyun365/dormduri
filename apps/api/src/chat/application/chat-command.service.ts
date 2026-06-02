import { createLeaveThreadCommand } from '../commands/leave-thread.command.js';
import { createSendMessageCommand } from '../commands/send-message.command.js';
import { createUpdateReadMarkerCommand } from '../commands/update-read-marker.command.js';
import type { ChatCommandDeps, ChatCommandService } from '../commands/chat-command.types.js';

export function createChatCommandService(deps: ChatCommandDeps): ChatCommandService {
  return {
    sendMessage: createSendMessageCommand(deps),
    updateReadMarker: createUpdateReadMarkerCommand(deps),
    leaveThread: createLeaveThreadCommand(deps),
  };
}
