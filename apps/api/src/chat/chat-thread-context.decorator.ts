import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common';
import { RequireDomainContext } from '../common/domain-context/domain-context.decorator.js';
import { ChatThreadContextGuard } from './chat-thread-context.guard.js';
import {
  getChatThreadContext,
  type ChatThreadContextRequest,
} from './chat-thread-context.types.js';

export function RequireChatThreadMember() {
  return applyDecorators(
    RequireDomainContext({
      kind: 'chat-thread-member',
      mode: 'require-existing',
      param: 'threadId',
    }),
    UseGuards(ChatThreadContextGuard),
  );
}

export const ChatThread = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<ChatThreadContextRequest>();
  const chatThread = getChatThreadContext(request);
  if (!chatThread) {
    throw new Error('[ChatThread] guard must run before decorator');
  }

  return chatThread;
});
