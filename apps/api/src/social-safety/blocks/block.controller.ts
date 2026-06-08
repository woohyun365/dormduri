import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  createBlockRequestSchema,
  deleteBlockRequestSchema,
  listBlocksQuerySchema,
} from '@repo/shared/social-safety/block';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parseQueryObject, parseRequestBody } from '../../platform/http/zod-request.js';
import { BlockService } from './application/block.service.js';
import { blockErrors } from './errors/block.errors.js';

@Controller('api/blocks')
@RequireCapability()
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Get()
  async list(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = parseQueryObject(listBlocksQuerySchema, query, {
      code: 'INVALID_BLOCK_QUERY',
      errorMessage: '차단 목록 요청이 올바르지 않습니다.',
    });
    return this.blockService.list(authUser, parsed);
  }

  @Post(':targetUserId')
  async create(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
    @Body() body: unknown,
  ) {
    const parsedTargetUserId = parseBlockTargetUserId(targetUserId);
    const parsedBody = parseRequestBody(
      createBlockRequestSchema,
      body ?? {},
      '차단 요청 본문이 올바르지 않습니다.',
    );
    return this.blockService.create(authUser, parsedTargetUserId, parsedBody);
  }

  @Delete(':targetUserId')
  async delete(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('targetUserId') targetUserId: string,
    @Body() body: unknown,
  ) {
    const parsedTargetUserId = parseBlockTargetUserId(targetUserId);
    parseRequestBody(
      deleteBlockRequestSchema,
      body ?? {},
      '차단 해제 요청 본문이 올바르지 않습니다.',
    );
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
