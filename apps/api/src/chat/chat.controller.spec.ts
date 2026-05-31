import { BadRequestException } from '@nestjs/common';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import { ChatController } from './chat.controller.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as { code: string; fieldErrors?: Record<string, string[]> };
}

describe('ChatController', () => {
  const chatService = {
    listThreads: jest.fn(),
    getThreadEntry: jest.fn(),
    getThreadDetail: jest.fn(),
    leaveThread: jest.fn(),
    sendMessage: jest.fn(),
  };

  const controller = new ChatController(chatService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('controller class는 AuthenticatedUserGuard로 보호된다', () => {
    const guards = Reflect.getMetadata('__guards__', ChatController) as Array<unknown> | undefined;
    expect(guards).toBeDefined();
    expect(guards).toContain(AuthenticatedUserGuard);
  });

  it('빈 message body는 bad request를 던진다', async () => {
    try {
      await controller.sendMessage(authUser as never, {
        targetUserId: 'user-2',
        body: '   ',
      });
      throw new Error('Expected sendMessage to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);
      expect(response.code).toBe('INVALID_REQUEST_BODY');
    }
  });
});
