import {
  Body,
  Controller,
  createParamDecorator,
  Get,
  Param,
  Post,
  Query,
  type ExecutionContext,
} from '@nestjs/common';
import {
  appendSupportTicketMessageRequestSchema,
  createSupportTicketRequestSchema,
  listSupportFaqQuerySchema,
  listSupportTicketsQuerySchema,
  replySupportTicketRequestSchema,
  resolveSupportTicketRequestSchema,
  type AppendSupportTicketMessageRequest,
  type CreateSupportTicketRequest,
  type ListSupportFaqQuery,
} from '@repo/shared/support';
import { Public, RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import {
  parsePathParam,
  parseQueryObject,
  parseRequestBody,
} from '../platform/http/zod-request.js';
import { SupportService } from './application/support.service.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';

const supportIdPathSchema = createSupportTicketRequestSchema.shape.relatedEntityId
  .unwrap()
  .unwrap();

interface RawSupportMessage {
  ticketId: unknown;
  body: unknown;
}

interface SupportMessageInput {
  ticketId: string;
  body: AppendSupportTicketMessageRequest;
}

// Extract only; validation stays in one ordered Pipe because Nest resolves parameters concurrently.
const SupportMessage = createParamDecorator(
  (_: unknown, context: ExecutionContext): RawSupportMessage => {
    const request = context
      .switchToHttp()
      .getRequest<{ params: { ticketId: string }; body?: unknown }>();
    return { ticketId: request.params.ticketId, body: request.body };
  },
);

const supportMessagePipe = new ZodRequestPipe((input: RawSupportMessage): SupportMessageInput => {
  const ticketId = parsePathParam(supportIdPathSchema, input.ticketId, {
    code: 'INVALID_SUPPORT_TICKET_ID',
    errorMessage: '문의 식별자가 올바르지 않습니다.',
    fieldName: 'ticketId',
  });
  const body = parseRequestBody(
    appendSupportTicketMessageRequestSchema,
    input.body ?? {},
    '문의 메시지 요청 본문이 올바르지 않습니다.',
  );
  return { ticketId, body };
});

@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Get('api/support/faq')
  listFaq(
    @Query(
      new ZodRequestPipe((query: unknown) =>
        parseQueryObject(listSupportFaqQuerySchema, query, {
          code: 'INVALID_SUPPORT_FAQ_QUERY',
          errorMessage: 'FAQ 목록 요청이 올바르지 않습니다.',
        }),
      ),
    )
    query: ListSupportFaqQuery,
  ) {
    return this.supportService.listFaq(query);
  }

  @Public()
  @Get('api/support/faq/:articleId')
  getFaq(
    @Param(
      'articleId',
      new ZodRequestPipe((value: unknown) =>
        parsePathParam(supportIdPathSchema, value, {
          code: 'INVALID_SUPPORT_FAQ_ID',
          errorMessage: 'FAQ 식별자가 올바르지 않습니다.',
          fieldName: 'articleId',
        }),
      ),
    )
    articleId: string,
  ) {
    return this.supportService.getFaq(articleId);
  }

  @RequireCapability()
  @Post('api/support/tickets')
  createTicket(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body(
      new ZodRequestPipe((body: unknown) =>
        parseRequestBody(
          createSupportTicketRequestSchema,
          body ?? {},
          '문의 생성 요청 본문이 올바르지 않습니다.',
        ),
      ),
    )
    body: CreateSupportTicketRequest,
  ) {
    return this.supportService.createTicket(authUser, body);
  }

  @RequireCapability()
  @Get('api/support/tickets')
  listOwnTickets(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(listSupportTicketsQuerySchema, query, {
      code: 'INVALID_SUPPORT_TICKET_QUERY',
      errorMessage: '문의 목록 요청이 올바르지 않습니다.',
    });
    return this.supportService.listOwnTickets(authUser, parsed);
  }

  @RequireCapability()
  @Get('api/support/tickets/:ticketId')
  getOwnTicket(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('ticketId') ticketId: string,
  ) {
    const parsed = parsePathParam(supportIdPathSchema, ticketId, {
      code: 'INVALID_SUPPORT_TICKET_ID',
      errorMessage: '문의 식별자가 올바르지 않습니다.',
      fieldName: 'ticketId',
    });
    return this.supportService.getOwnTicket(authUser, parsed);
  }

  @RequireCapability()
  @Post('api/support/tickets/:ticketId/messages')
  appendOwnMessage(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @SupportMessage(supportMessagePipe) input: SupportMessageInput,
  ) {
    return this.supportService.appendOwnMessage(authUser, input.ticketId, input.body);
  }

  @RequireCapability('admin:support:read')
  @Get('api/operations/support/tickets')
  listOperationTickets(@Query() query: Record<string, unknown>) {
    const parsed = parseQueryObject(listSupportTicketsQuerySchema, query, {
      code: 'INVALID_SUPPORT_TICKET_QUERY',
      errorMessage: '운영 문의 목록 요청이 올바르지 않습니다.',
    });
    return this.supportService.listOperationTickets(parsed);
  }

  @RequireCapability('admin:support:read')
  @Get('api/operations/support/tickets/:ticketId')
  getOperationTicket(@Param('ticketId') ticketId: string) {
    const parsed = parsePathParam(supportIdPathSchema, ticketId, {
      code: 'INVALID_SUPPORT_TICKET_ID',
      errorMessage: '문의 식별자가 올바르지 않습니다.',
      fieldName: 'ticketId',
    });
    return this.supportService.getOperationTicket(parsed);
  }

  @RequireCapability('admin:support:reply')
  @Post('api/operations/support/tickets/:ticketId/replies')
  replyAsOperator(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    const parsedTicketId = parsePathParam(supportIdPathSchema, ticketId, {
      code: 'INVALID_SUPPORT_TICKET_ID',
      errorMessage: '문의 식별자가 올바르지 않습니다.',
      fieldName: 'ticketId',
    });
    const parsedBody = parseRequestBody(
      replySupportTicketRequestSchema,
      body ?? {},
      '운영 문의 답변 요청 본문이 올바르지 않습니다.',
    );
    return this.supportService.replyAsOperator(authUser, parsedTicketId, parsedBody);
  }

  @RequireCapability('admin:support:resolve')
  @Post('api/operations/support/tickets/:ticketId/resolve')
  resolveAsOperator(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    const parsedTicketId = parsePathParam(supportIdPathSchema, ticketId, {
      code: 'INVALID_SUPPORT_TICKET_ID',
      errorMessage: '문의 식별자가 올바르지 않습니다.',
      fieldName: 'ticketId',
    });
    const parsedBody = parseRequestBody(
      resolveSupportTicketRequestSchema,
      body ?? {},
      '운영 문의 종료 요청 본문이 올바르지 않습니다.',
    );
    return this.supportService.resolveAsOperator(authUser, parsedTicketId, parsedBody);
  }
}
