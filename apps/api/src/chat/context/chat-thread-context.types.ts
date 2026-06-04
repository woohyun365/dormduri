import type { AuthenticatedRequest } from '../../auth/application/auth-actor-context.types.js';
import type {
  ConversationThreadMemberState,
  ConversationThreadStatus,
} from '../../generated/prisma/enums.js';

export interface ChatThreadContext {
  threadId: string;
  actorUserId: string;
  actorParticipantId: string;
  memberState: ConversationThreadMemberState;
  threadStatus: ConversationThreadStatus;
  closedAt: Date | null;
  closedReason: string | null;
  lastVisibleAt: Date | null;
}

export interface ChatThreadDomainContexts {
  chatThread?: ChatThreadContext;
}

export interface ChatThreadContextRequest extends AuthenticatedRequest {
  domainContexts?: ChatThreadDomainContexts;
}

export function setChatThreadContext(
  request: ChatThreadContextRequest,
  chatThread: ChatThreadContext,
) {
  request.domainContexts ??= {};
  request.domainContexts.chatThread = chatThread;
}

export function getChatThreadContext(request: ChatThreadContextRequest) {
  return request.domainContexts?.chatThread ?? null;
}
