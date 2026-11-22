import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import {
  accessRequestApproveRequestSchema,
  accessRequestCreateRequestSchema,
  accessRequestListQuerySchema,
  accessRequestRejectRequestSchema,
  type AccessRequestApproveRequest,
  type AccessRequestCreateRequest,
  type AccessRequestListQuery,
  type AccessRequestRejectRequest,
} from '@repo/shared/backoffice';
import type { AdminRequestSession } from '../../platform/http/request-context.js';
import { CurrentSession, RequestId } from '../../platform/http/request-decorators.js';
import { UuidParamPipe, ZodPipe } from '../../platform/http/zod-pipe.js';
import { RequirePermission } from '../route-access.js';
import { ApprovalRequestsService } from './approval-requests.service.js';

@Controller('access/requests')
export class ApprovalRequestsController {
  constructor(
    @Inject(ApprovalRequestsService) private readonly requests: ApprovalRequestsService,
  ) {}

  @Get()
  @RequirePermission(['admin:access:request', 'admin:access:approve'])
  list(@Query(new ZodPipe(accessRequestListQuerySchema)) query: AccessRequestListQuery) {
    return this.requests.list(query);
  }

  @Post()
  @RequirePermission('admin:access:request', { reauthentication: true })
  @HttpCode(200)
  create(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(accessRequestCreateRequestSchema)) body: AccessRequestCreateRequest,
    @RequestId() requestId: string,
  ) {
    return this.requests.create(session, body, requestId);
  }

  @Post(':requestId/approve')
  @RequirePermission('admin:access:approve', { reauthentication: true })
  @HttpCode(200)
  approve(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @Body(new ZodPipe(accessRequestApproveRequestSchema)) body: AccessRequestApproveRequest,
    @RequestId() requestId: string,
  ) {
    return this.requests.approve(session, requestId, approvalRequestId, body);
  }

  @Post(':requestId/reject')
  @RequirePermission('admin:access:approve', { reauthentication: true })
  @HttpCode(200)
  reject(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @Body(new ZodPipe(accessRequestRejectRequestSchema)) body: AccessRequestRejectRequest,
    @RequestId() requestId: string,
  ) {
    return this.requests.reject(session, requestId, approvalRequestId, body);
  }

  @Post(':requestId/cancel')
  @RequirePermission('admin:access:request')
  @HttpCode(200)
  cancel(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @RequestId() requestId: string,
  ) {
    return this.requests.cancel(session, requestId, approvalRequestId);
  }
}
