import {
  createParamDecorator,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  type ExecutionContext,
} from '@nestjs/common';
import {
  createBlockRequestSchema,
  deleteBlockRequestSchema,
  listBlocksQuerySchema,
  type CreateBlockRequest,
  type ListBlocksQuery,
} from '@repo/shared/social-safety/block';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parseQueryObject, parseRequestBody } from '../../platform/http/zod-request.js';
import { ZodRequestPipe } from '../../platform/http/zod-request.pipe.js';
import { BlockService } from './application/block.service.js';
import { blockErrors } from './errors/block.errors.js';

interface RawBlockRequest {
  targetUserId: string;
  body: unknown;
}
// One ordered pipe preserves path-before-body errors; extraction does not validate.
const BlockRequest = createParamDecorator(
  (_: unknown, context: ExecutionContext): RawBlockRequest => {
    const request = context
      .switchToHttp()
      .getRequest<{ params: { targetUserId: string }; body?: unknown }>();
    return { targetUserId: request.params.targetUserId, body: request.body };
  },
);

@Controller('api/blocks')
@RequireCapability()
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Get()
  async list(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query(
      new ZodRequestPipe((query: unknown) =>
        parseQueryObject(listBlocksQuerySchema, query, {
          code: 'INVALID_BLOCK_QUERY',
          errorMessage: '차단 목록 요청이 올바르지 않습니다.',
        }),
      ),
    )
    parsed: ListBlocksQuery,
  ) {
    return this.blockService.list(authUser, parsed);
  }

  @Post(':targetUserId')
  async create(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @BlockRequest(
      new ZodRequestPipe((input: RawBlockRequest) => {
        const parsedTargetUserId = parseBlockTargetUserId(input.targetUserId);
        const parsedBody = parseRequestBody(
          createBlockRequestSchema,
          input.body ?? {},
          '차단 요청 본문이 올바르지 않습니다.',
        );
        return { targetUserId: parsedTargetUserId, body: parsedBody };
      }),
    )
    input: { targetUserId: string; body: CreateBlockRequest },
  ) {
    return this.blockService.create(authUser, input.targetUserId, input.body);
  }

  @Delete(':targetUserId')
  async delete(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @BlockRequest(
      new ZodRequestPipe((input: RawBlockRequest) => {
        const parsedTargetUserId = parseBlockTargetUserId(input.targetUserId);
        parseRequestBody(
          deleteBlockRequestSchema,
          input.body ?? {},
          '차단 해제 요청 본문이 올바르지 않습니다.',
        );
        return parsedTargetUserId;
      }),
    )
    parsedTargetUserId: string,
  ) {
    return this.blockService.delete(authUser, parsedTargetUserId);
  }
}

function parseBlockTargetUserId(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    throw blockErrors.invalidBlockTarget();
  }

  return trimmed;
}
