import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Body,
  Controller,
  Post,
  type INestApplication,
  type PipeTransform,
  type Type,
} from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createSupportTicketRequestSchema } from '@repo/shared/support';
import { SupportController } from '../../support/support.controller.js';
import { SupportService } from '../../support/application/support.service.js';
import { DormitoriesController } from '../../dormitories/dormitories.controller.js';
import { DormitoriesService } from '../../dormitories/application/dormitories.service.js';
import { AuthActorContextResolver } from '../../auth/application/auth-actor-context.resolver.js';
import { AuthenticatedUserGuard } from '../../auth/access/authenticated-user.guard.js';
import { CurrentAuthToken, CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import {
  OptionalAuth,
  Public,
  RequireCapability,
} from '../../auth/access/auth-access.decorator.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { parseRequestBody } from './zod-request.js';

const actor = {
  id: 'user-1',
  actorId: 'user-1',
  actorType: 'USER' as const,
  sessionId: 'session-1',
  campus: 'CHUNCHEON' as const,
  gender: 'M' as const,
  capabilities: [],
};
const rawTicket = { category: 'OTHER', subject: ' subject ', body: ' message ' };
const parsedTicket = {
  category: 'OTHER',
  subject: 'subject',
  body: 'message',
  emailReplyConsent: false,
};
const support = {
  listFaq: vi.fn(),
  getFaq: vi.fn(),
  createTicket: vi.fn(),
  appendOwnMessage: vi.fn(),
};
const dormitories = { getDormitories: vi.fn(), getDormitoryById: vi.fn() };
const resolver = { resolveCurrentUserContext: vi.fn() };
const logger = { write: vi.fn() };
const metrics = { recordException: vi.fn() };
const probeHandler = vi.fn();

// Real decorators in the existing auth argument arrangements, without changing auth routes.
@Controller('binding-probe')
class DecoratorProbeController {
  @Public()
  @Post('required-token')
  requiredToken(@CurrentAuthToken() token: string, @Body() body: unknown) {
    const parsed = parseRequestBody(createSupportTicketRequestSchema, body ?? {});
    probeHandler(token, parsed);
    return { token, parsed };
  }

  @OptionalAuth()
  @Post('optional-token')
  optionalToken(@CurrentAuthToken({ optional: true }) token: string | null, @Body() body: unknown) {
    const parsed = parseRequestBody(createSupportTicketRequestSchema, body ?? {});
    probeHandler(token, parsed);
    return { token, parsed };
  }

  @Public()
  @Post('missing-actor')
  missingActor(@Body() body: unknown, @CurrentUser() user: unknown) {
    const parsed = parseRequestBody(createSupportTicketRequestSchema, body ?? {});
    probeHandler(user, parsed);
    return parsed;
  }

  @RequireCapability('admin:support:reply')
  @Post('capability')
  capability(@Body() body: unknown, @CurrentUser() user: unknown) {
    const parsed = parseRequestBody(createSupportTicketRequestSchema, body ?? {});
    probeHandler(user, parsed);
    return parsed;
  }
}

async function createApp() {
  const module = await Test.createTestingModule({
    controllers: [SupportController, DormitoriesController, DecoratorProbeController],
    providers: [
      { provide: SupportService, useValue: support },
      { provide: DormitoriesService, useValue: dormitories },
      { provide: AuthActorContextResolver, useValue: resolver },
      AuthenticatedUserGuard,
      Reflector,
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.useGlobalGuards(module.get(AuthenticatedUserGuard));
    app.useGlobalFilters(new ApiExceptionFilter(logger as never, metrics as never));
    await app.listen(0, '127.0.0.1');
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

function errorBody(response: request.Response) {
  const { timestamp, ...body } = response.body as Record<string, unknown>;
  expect(timestamp).toEqual(expect.any(String));
  expect(new Date(timestamp as string).toISOString()).toBe(timestamp);
  expect(response.headers['content-type']).toContain('application/json');
  return body;
}

function boundPipes(controller: Type<unknown>, method: string): PipeTransform[] {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) as
    Record<string, { pipes?: PipeTransform[] }> | undefined;
  return Object.values(metadata ?? {}).flatMap(({ pipes }) => pipes ?? []);
}

describe('existing HTTP behavior', () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    app = await createApp();
    url = await app.getUrl();
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    resolver.resolveCurrentUserContext.mockImplementation((token: string | null) =>
      token === 'valid-token' ? actor : null,
    );
    for (const service of [...Object.values(support), ...Object.values(dormitories)])
      service.mockReturnValue({ ok: true });
  });

  it('createTicket preserves trimming, default consent and the service argument', async () => {
    const response = await request(url)
      .post('/api/support/tickets')
      .auth('valid-token', { type: 'bearer' })
      .send(rawTicket);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true });
    expect(support.createTicket).toHaveBeenCalledExactlyOnceWith(actor, parsedTicket);
  });

  it('createTicket missing body has the exact current field errors and never calls service', async () => {
    const response = await request(url)
      .post('/api/support/tickets')
      .auth('valid-token', { type: 'bearer' });
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_REQUEST_BODY",
        "details": [
          {
            "code": "invalid_value",
            "message": "허용되지 않는 값입니다.",
            "path": "category",
            "sourceMessage": "Invalid option: expected one of "ACCOUNT"|"SEASON"|"MATCHING"|"REPORT_OR_BLOCK"|"APPEAL"|"BUG"|"OTHER"",
          },
          {
            "code": "invalid_type",
            "message": "필수 값이 누락되었습니다.",
            "path": "subject",
            "sourceMessage": "Invalid input: expected string, received undefined",
          },
          {
            "code": "invalid_type",
            "message": "필수 값이 누락되었습니다.",
            "path": "body",
            "sourceMessage": "Invalid input: expected string, received undefined",
          },
        ],
        "error": "문의 생성 요청 본문이 올바르지 않습니다.",
        "fieldErrors": {
          "body": [
            "필수 값이 누락되었습니다.",
          ],
          "category": [
            "허용되지 않는 값입니다.",
          ],
          "subject": [
            "필수 값이 누락되었습니다.",
          ],
        },
        "formErrors": [],
        "path": "/api/support/tickets",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.createTicket).not.toHaveBeenCalled();
  });

  it('createTicket array body keeps form errors', async () => {
    const response = await request(url)
      .post('/api/support/tickets')
      .auth('valid-token', { type: 'bearer' })
      .send([]);
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_REQUEST_BODY",
        "details": [
          {
            "code": "invalid_type",
            "message": "필수 값이 누락되었습니다.",
            "path": "",
            "sourceMessage": "Invalid input: expected object, received array",
          },
        ],
        "error": "문의 생성 요청 본문이 올바르지 않습니다.",
        "fieldErrors": {},
        "formErrors": [
          "필수 값이 누락되었습니다.",
        ],
        "path": "/api/support/tickets",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.createTicket).not.toHaveBeenCalled();
  });

  it('createTicket rejects unknown keys without losing source details', async () => {
    const response = await request(url)
      .post('/api/support/tickets')
      .auth('valid-token', { type: 'bearer' })
      .send({ ...rawTicket, extra: true });
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_REQUEST_BODY",
        "details": [
          {
            "code": "unrecognized_keys",
            "message": "알 수 없는 필드가 포함되어 있습니다: extra",
            "path": "",
            "sourceMessage": "Unrecognized key: "extra"",
          },
        ],
        "error": "문의 생성 요청 본문이 올바르지 않습니다.",
        "fieldErrors": {},
        "formErrors": [
          "알 수 없는 필드가 포함되어 있습니다: extra",
        ],
        "path": "/api/support/tickets",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.createTicket).not.toHaveBeenCalled();
  });

  it.each([{}, { category: 'OTHER' }])('listFaq passes the parsed query %j', async (query) => {
    const response = await request(url).get('/api/support/faq').query(query);
    expect(response.status).toBe(200);
    expect(support.listFaq).toHaveBeenCalledExactlyOnceWith(query);
    expect(resolver.resolveCurrentUserContext).not.toHaveBeenCalled();
  });

  it('listFaq invalid category keeps the current query error', async () => {
    const response = await request(url).get('/api/support/faq?category=WRONG');
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_SUPPORT_FAQ_QUERY",
        "details": [
          {
            "code": "invalid_value",
            "message": "허용되지 않는 쿼리 파라미터 값입니다.",
            "path": "category",
            "sourceMessage": "Invalid option: expected one of "ACCOUNT"|"SEASON"|"MATCHING"|"REPORT_OR_BLOCK"|"APPEAL"|"BUG"|"OTHER"",
          },
        ],
        "error": "FAQ 목록 요청이 올바르지 않습니다.",
        "fieldErrors": {
          "category": [
            "허용되지 않는 쿼리 파라미터 값입니다.",
          ],
        },
        "formErrors": [],
        "path": "/api/support/faq?category=WRONG",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.listFaq).not.toHaveBeenCalled();
  });

  it('listFaq rejects repeated category values, not just its first value', async () => {
    const response = await request(url).get('/api/support/faq?category=OTHER&category=BUG');
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_SUPPORT_FAQ_QUERY",
        "details": [
          {
            "code": "invalid_value",
            "message": "허용되지 않는 쿼리 파라미터 값입니다.",
            "path": "category",
            "sourceMessage": "Invalid option: expected one of "ACCOUNT"|"SEASON"|"MATCHING"|"REPORT_OR_BLOCK"|"APPEAL"|"BUG"|"OTHER"",
          },
        ],
        "error": "FAQ 목록 요청이 올바르지 않습니다.",
        "fieldErrors": {
          "category": [
            "허용되지 않는 쿼리 파라미터 값입니다.",
          ],
        },
        "formErrors": [],
        "path": "/api/support/faq?category=OTHER&category=BUG",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.listFaq).not.toHaveBeenCalled();
  });

  it('getFaq uses trimmed string IDs rather than a UUID-only constraint', async () => {
    const response = await request(url).get('/api/support/faq/%20article-1%20');
    expect(response.status).toBe(200);
    expect(support.getFaq).toHaveBeenCalledExactlyOnceWith('article-1');
  });

  it('getFaq whitespace ID reaches the path parser and keeps its custom field error', async () => {
    const response = await request(url).get('/api/support/faq/%20');
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_SUPPORT_FAQ_ID",
        "details": [
          {
            "code": "too_small",
            "message": "최소 허용 기준보다 작습니다.",
            "path": "articleId",
            "sourceMessage": "Too small: expected string to have >=1 characters",
          },
        ],
        "error": "FAQ 식별자가 올바르지 않습니다.",
        "fieldErrors": {
          "articleId": [
            "최소 허용 기준보다 작습니다.",
          ],
        },
        "formErrors": [],
        "path": "/api/support/faq/%20",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.getFaq).not.toHaveBeenCalled();
  });

  it('getFaq rejects overlength IDs', async () => {
    const response = await request(url).get(`/api/support/faq/${'a'.repeat(129)}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_SUPPORT_FAQ_ID',
      fieldErrors: { articleId: ['최대 허용 기준을 초과했습니다.'] },
    });
    expect(support.getFaq).not.toHaveBeenCalled();
  });

  it('appendOwnMessage valid path/body preserve parsed service inputs', async () => {
    const response = await request(url)
      .post('/api/support/tickets/%20ticket-1%20/messages')
      .auth('valid-token', { type: 'bearer' })
      .send({ body: ' hello ' });
    expect(response.status).toBe(201);
    expect(support.appendOwnMessage).toHaveBeenCalledExactlyOnceWith(actor, 'ticket-1', {
      body: 'hello',
    });
  });

  it('appendOwnMessage valid path / invalid body keeps its message error', async () => {
    const response = await request(url)
      .post('/api/support/tickets/ticket-1/messages')
      .auth('valid-token', { type: 'bearer' })
      .send({});
    expect(response.status).toBe(400);
    expect(errorBody(response)).toMatchInlineSnapshot(`
      {
        "code": "INVALID_REQUEST_BODY",
        "details": [
          {
            "code": "invalid_type",
            "message": "필수 값이 누락되었습니다.",
            "path": "body",
            "sourceMessage": "Invalid input: expected string, received undefined",
          },
        ],
        "error": "문의 메시지 요청 본문이 올바르지 않습니다.",
        "fieldErrors": {
          "body": [
            "필수 값이 누락되었습니다.",
          ],
        },
        "formErrors": [],
        "path": "/api/support/tickets/ticket-1/messages",
        "statusCode": 400,
        "success": false,
      }
    `);
    expect(support.appendOwnMessage).not.toHaveBeenCalled();
  });

  it('appendOwnMessage path-first is stable for invalid path with either body', async () => {
    for (const body of [{ body: 'valid' }, {}, {}, {}, {}]) {
      const response = await request(url)
        .post('/api/support/tickets/%20/messages')
        .auth('valid-token', { type: 'bearer' })
        .send(body);
      expect(response.status).toBe(400);
      expect(errorBody(response)).toMatchInlineSnapshot(`
        {
          "code": "INVALID_SUPPORT_TICKET_ID",
          "details": [
            {
              "code": "too_small",
              "message": "최소 허용 기준보다 작습니다.",
              "path": "ticketId",
              "sourceMessage": "Too small: expected string to have >=1 characters",
            },
          ],
          "error": "문의 식별자가 올바르지 않습니다.",
          "fieldErrors": {
            "ticketId": [
              "최소 허용 기준보다 작습니다.",
            ],
          },
          "formErrors": [],
          "path": "/api/support/tickets/%20/messages",
          "statusCode": 400,
          "success": false,
        }
      `);
    }
    expect(support.appendOwnMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['CHUNCHEON', 'M'],
    ['CHUNCHEON', undefined],
    ['CHUNCHEON', 'WRONG'],
    ['WRONG', 'M'],
    ['WRONG', undefined],
    ['WRONG', 'WRONG'],
    [undefined, 'M'],
    [undefined, undefined],
    [undefined, 'WRONG'],
  ])(
    'dormitories campus=%s gender=%s preserves campus-first and undefined',
    async (campus, gender) => {
      const query = {
        ...(campus === undefined ? {} : { campus }),
        ...(gender === undefined ? {} : { gender }),
      };
      const response = await request(url).get('/api/dormitories').query(query);
      if (campus === 'CHUNCHEON' && gender !== 'WRONG') {
        expect(response.status).toBe(200);
        expect(dormitories.getDormitories).toHaveBeenCalledExactlyOnceWith(campus, gender);
      } else {
        expect(response.status).toBe(400);
        const field = campus === 'CHUNCHEON' ? 'gender' : 'campus';
        expect(response.body).toMatchObject({
          code:
            field === 'campus'
              ? 'DORMITORIES_INVALID_CAMPUS_QUERY'
              : 'DORMITORIES_INVALID_GENDER_QUERY',
          error: `${field} 쿼리 파라미터 값이 올바르지 않습니다.`,
          fieldErrors: { [field]: ['허용되지 않는 쿼리 파라미터 값입니다.'] },
        });
        expect(dormitories.getDormitories).not.toHaveBeenCalled();
      }
    },
  );

  it('dormitories both-invalid exact error stays stable over repeated requests', async () => {
    for (let repeat = 0; repeat < 5; repeat++) {
      const response = await request(url).get('/api/dormitories?campus=WRONG&gender=WRONG');
      expect(response.status).toBe(400);
      expect(errorBody(response)).toMatchInlineSnapshot(`
        {
          "code": "DORMITORIES_INVALID_CAMPUS_QUERY",
          "details": [
            {
              "code": "invalid_value",
              "message": "허용되지 않는 쿼리 파라미터 값입니다.",
              "path": "campus",
              "sourceMessage": "Invalid option: expected one of "CHUNCHEON"|"SAMCHEOK"|"DOGYE"",
            },
          ],
          "error": "campus 쿼리 파라미터 값이 올바르지 않습니다.",
          "fieldErrors": {
            "campus": [
              "허용되지 않는 쿼리 파라미터 값입니다.",
            ],
          },
          "formErrors": [],
          "path": "/api/dormitories?campus=WRONG&gender=WRONG",
          "statusCode": 400,
          "success": false,
        }
      `);
    }
    expect(dormitories.getDormitories).not.toHaveBeenCalled();
  });

  it('guard rejection wins over invalid body and prevents bound parsing', async () => {
    const pipes = boundPipes(SupportController, 'createTicket').map((pipe) =>
      vi.spyOn(pipe, 'transform'),
    );
    const response = await request(url).post('/api/support/tickets').send({});
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED', error: '로그인이 필요합니다.' });
    pipes.forEach((pipe) => expect(pipe).not.toHaveBeenCalled());
    expect(support.createTicket).not.toHaveBeenCalled();
  });

  it('capability guard rejects before the invalid body', async () => {
    const response = await request(url)
      .post('/binding-probe/capability')
      .auth('valid-token', { type: 'bearer' })
      .send({});
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'INSUFFICIENT_CAPABILITY' });
    expect(probeHandler).not.toHaveBeenCalled();
  });

  it.each(['required-token', 'missing-actor'])(
    '%s decorator failure wins over invalid body without becoming a new auth policy',
    async (route) => {
      for (let repeat = 0; repeat < 5; repeat++) {
        const response = await request(url).post(`/binding-probe/${route}`).send({});
        expect(response.status).toBe(500);
        expect(response.body).toMatchObject({
          code: 'INTERNAL_SERVER_ERROR',
          error: '일시적인 서버 오류가 발생했습니다.',
        });
      }
      expect(probeHandler).not.toHaveBeenCalled();
    },
  );

  it('optional token absence stays null while the body is normalized', async () => {
    const response = await request(url).post('/binding-probe/optional-token').send(rawTicket);
    expect(response.status).toBe(201);
    expect(probeHandler).toHaveBeenCalledExactlyOnceWith(null, parsedTicket);
  });

  it('required token extraction succeeds before normal body validation', async () => {
    const response = await request(url)
      .post('/binding-probe/required-token')
      .auth('valid-token', { type: 'bearer' })
      .send(rawTicket);
    expect(response.status).toBe(201);
    expect(probeHandler).toHaveBeenCalledExactlyOnceWith('valid-token', parsedTicket);
  });

  it.each(
    (
      [
        [SupportController, 'createTicket', 'POST', '/api/support/tickets', rawTicket],
        [SupportController, 'listFaq', 'GET', '/api/support/faq?category=OTHER', undefined],
        [SupportController, 'getFaq', 'GET', '/api/support/faq/article-1', undefined],
        [
          SupportController,
          'appendOwnMessage',
          'POST',
          '/api/support/tickets/ticket-1/messages',
          { body: 'hello' },
        ],
        [
          DormitoriesController,
          'getDormitories',
          'GET',
          '/api/dormitories?campus=CHUNCHEON',
          undefined,
        ],
      ] as const
    ).map(([controller, method, verb, path, body]) => ({
      controller,
      method,
      verb,
      path,
      body,
      name: `${controller.name}.${method}`,
    })),
  )(
    'actual binding invokes the parsing Pipe: $name',
    async ({ controller, method, verb, path, body }) => {
      const pipes = boundPipes(controller, method);
      expect(
        pipes.length,
        `Missing route parsing Pipe: ${controller.name}.${method}`,
      ).toBeGreaterThan(0);
      const transforms = pipes.map((pipe) => vi.spyOn(pipe, 'transform'));
      const call = verb === 'POST' ? request(url).post(path).send(body) : request(url).get(path);
      const response = await call.auth('valid-token', { type: 'bearer' });
      expect(response.status).toBe(verb === 'POST' ? 201 : 200);
      transforms.forEach((transform) => expect(transform).toHaveBeenCalledOnce());
    },
  );
});
