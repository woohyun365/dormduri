import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  type PipeTransform,
} from '@nestjs/common';
import {
  legalDraftCreateRequestSchema,
  legalDraftDiscardRequestSchema,
  legalDraftListQuerySchema,
  legalDraftUpdateRequestSchema,
  legalPublishRequestCreateSchema,
  legalRequestApproveRequestSchema,
  legalRequestListQuerySchema,
  legalRequestRejectRequestSchema,
  legalWithdrawRequestCreateSchema,
  type LegalDraftCreateRequest,
  type LegalDraftDiscardRequest,
  type LegalDraftListQuery,
  type LegalDraftUpdateRequest,
  type LegalPublishRequestCreate,
  type LegalRequestApproveRequest,
  type LegalRequestListQuery,
  type LegalRequestRejectRequest,
  type LegalWithdrawRequestCreate,
} from '@repo/shared/backoffice';
import { RequirePermission } from '../access-control/route-access.js';
import { BackofficeApiError } from '../platform/http/api-error.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import { CurrentSession, RequestId } from '../platform/http/request-decorators.js';
import { UuidParamPipe, ZodPipe } from '../platform/http/zod-pipe.js';
import { LegalDraftsService } from './legal-drafts.service.js';
import { LegalRequestsService } from './legal-requests.service.js';

const READ = ['admin:legal:edit', 'admin:legal:approve'] as const;
const VERSION_ID = /^[a-z0-9][a-z0-9-]{0,127}$/u;

/** Version ids are UUIDs for approved versions and kind-date slugs for the development seed. */
@Injectable()
class VersionIdParamPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== 'string' || !VERSION_ID.test(value)) {
      throw new BackofficeApiError('not_found');
    }
    return value;
  }
}

/**
 * Backoffice legal routes (plan D-LC3·D-LC9·D-LC10). Editing needs `admin:legal:edit`, deciding
 * `admin:legal:approve`; asking for a publication or withdrawal and deciding one re-authenticate
 * (OA-R4). Every action writes an audit row in its own transaction (D-LC14).
 */
@Controller('legal')
export class LegalController {
  constructor(
    @Inject(LegalDraftsService) private readonly drafts: LegalDraftsService,
    @Inject(LegalRequestsService) private readonly requests: LegalRequestsService,
  ) {}

  @Get('documents')
  @RequirePermission([...READ])
  documents() {
    return this.requests.documents();
  }

  @Get('versions/:versionId')
  @RequirePermission([...READ])
  version(@Param('versionId', VersionIdParamPipe) versionId: string) {
    return this.requests.version(versionId);
  }

  @Post('versions/:versionId/withdraw-requests')
  @RequirePermission('admin:legal:edit', { reauthentication: true })
  @HttpCode(200)
  requestWithdraw(
    @CurrentSession() session: AdminRequestSession,
    @Param('versionId', VersionIdParamPipe) versionId: string,
    @Body(new ZodPipe(legalWithdrawRequestCreateSchema)) body: LegalWithdrawRequestCreate,
    @RequestId() requestId: string,
  ) {
    return this.requests.requestWithdraw(session, versionId, body, requestId);
  }

  @Get('drafts')
  @RequirePermission([...READ])
  listDrafts(@Query(new ZodPipe(legalDraftListQuerySchema)) query: LegalDraftListQuery) {
    return this.drafts.list(query);
  }

  @Post('drafts')
  @RequirePermission('admin:legal:edit')
  @HttpCode(200)
  createDraft(
    @CurrentSession() session: AdminRequestSession,
    @Body(new ZodPipe(legalDraftCreateRequestSchema)) body: LegalDraftCreateRequest,
    @RequestId() requestId: string,
  ) {
    return this.drafts.create(session, body, requestId);
  }

  @Get('drafts/:draftId')
  @RequirePermission([...READ])
  draft(@Param('draftId', UuidParamPipe) draftId: string) {
    return this.drafts.detail(draftId);
  }

  @Put('drafts/:draftId')
  @RequirePermission('admin:legal:edit')
  updateDraft(
    @CurrentSession() session: AdminRequestSession,
    @Param('draftId', UuidParamPipe) draftId: string,
    @Body(new ZodPipe(legalDraftUpdateRequestSchema)) body: LegalDraftUpdateRequest,
    @RequestId() requestId: string,
  ) {
    return this.drafts.update(session, draftId, body, requestId);
  }

  @Post('drafts/:draftId/discard')
  @RequirePermission('admin:legal:edit')
  @HttpCode(200)
  discardDraft(
    @CurrentSession() session: AdminRequestSession,
    @Param('draftId', UuidParamPipe) draftId: string,
    @Body(new ZodPipe(legalDraftDiscardRequestSchema)) body: LegalDraftDiscardRequest,
    @RequestId() requestId: string,
  ) {
    return this.drafts.discard(session, draftId, body, requestId);
  }

  @Post('drafts/:draftId/publish-requests')
  @RequirePermission('admin:legal:edit', { reauthentication: true })
  @HttpCode(200)
  requestPublish(
    @CurrentSession() session: AdminRequestSession,
    @Param('draftId', UuidParamPipe) draftId: string,
    @Body(new ZodPipe(legalPublishRequestCreateSchema)) body: LegalPublishRequestCreate,
    @RequestId() requestId: string,
  ) {
    return this.drafts.requestPublish(session, draftId, body, requestId);
  }

  @Get('requests')
  @RequirePermission([...READ])
  listRequests(@Query(new ZodPipe(legalRequestListQuerySchema)) query: LegalRequestListQuery) {
    return this.requests.list(query);
  }

  @Get('requests/:requestId')
  @RequirePermission([...READ])
  request(@Param('requestId', UuidParamPipe) approvalRequestId: string) {
    return this.requests.detail(approvalRequestId);
  }

  @Post('requests/:requestId/approve')
  @RequirePermission('admin:legal:approve', { reauthentication: true })
  @HttpCode(200)
  approve(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @Body(new ZodPipe(legalRequestApproveRequestSchema)) body: LegalRequestApproveRequest,
    @RequestId() requestId: string,
  ) {
    return this.requests.approve(session, requestId, approvalRequestId, body);
  }

  @Post('requests/:requestId/reject')
  @RequirePermission('admin:legal:approve', { reauthentication: true })
  @HttpCode(200)
  reject(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @Body(new ZodPipe(legalRequestRejectRequestSchema)) body: LegalRequestRejectRequest,
    @RequestId() requestId: string,
  ) {
    return this.requests.reject(session, requestId, approvalRequestId, body);
  }

  @Post('requests/:requestId/cancel')
  @RequirePermission('admin:legal:edit')
  @HttpCode(200)
  cancel(
    @CurrentSession() session: AdminRequestSession,
    @Param('requestId', UuidParamPipe) approvalRequestId: string,
    @RequestId() requestId: string,
  ) {
    return this.requests.cancel(session, requestId, approvalRequestId);
  }
}
