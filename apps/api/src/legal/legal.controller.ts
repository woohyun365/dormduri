import { Controller, Get, Param, Query } from '@nestjs/common';
import { legalDocumentKindSchema, type LegalDocumentKind } from '@repo/shared/legal';
import { Public } from '../auth/access/auth-access.decorator.js';
import { parsePathParam } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { LegalService } from './application/legal.service.js';

function legalKindPipe() {
  return new ZodRequestPipe((kind: unknown) =>
    parsePathParam(legalDocumentKindSchema, kind, {
      code: 'INVALID_LEGAL_DOCUMENT_KIND',
      errorMessage: '법적 문서 종류가 올바르지 않습니다.',
      fieldName: 'kind',
    }),
  );
}

@Controller('api/legal')
@Public()
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('documents/active-bundle')
  getActiveBundle() {
    return this.legalService.getActiveBundle();
  }

  @Get('documents/:kind/active')
  getActiveDocument(@Param('kind', legalKindPipe()) parsedKind: LegalDocumentKind) {
    return this.legalService.getActiveDocument(parsedKind);
  }

  // A version key that is not a real YYYY-MM-DD date is answered as an unknown version (404), not as a
  // malformed request: a version address behaves like a page address.
  @Get('documents/:kind/page')
  getDocumentPage(
    @Param('kind', legalKindPipe()) parsedKind: LegalDocumentKind,
    @Query('version') version?: unknown,
  ) {
    return this.legalService.getDocumentPage(parsedKind, version);
  }

  @Get('documents/:kind/versions/:versionKey/comparison')
  getVersionComparison(
    @Param('kind', legalKindPipe()) parsedKind: LegalDocumentKind,
    @Param('versionKey') versionKey: string,
  ) {
    return this.legalService.getVersionComparison(parsedKind, versionKey);
  }

  @Get('revision-notices')
  getRevisionNotices() {
    return this.legalService.getRevisionNotices();
  }
}
