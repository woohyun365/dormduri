import { Controller, Get, Param } from '@nestjs/common';
import { legalDocumentKindSchema, type LegalDocumentKind } from '@repo/shared/legal';
import { Public } from '../auth/access/auth-access.decorator.js';
import { parsePathParam } from '../platform/http/zod-request.js';
import { ZodRequestPipe } from '../platform/http/zod-request.pipe.js';
import { LegalService } from './application/legal.service.js';

@Controller('api/legal')
@Public()
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('documents/active-bundle')
  getActiveBundle() {
    return this.legalService.getActiveBundle();
  }

  @Get('documents/:kind/active')
  getActiveDocument(
    @Param(
      'kind',
      new ZodRequestPipe((kind: unknown) =>
        parsePathParam(legalDocumentKindSchema, kind, {
          code: 'INVALID_LEGAL_DOCUMENT_KIND',
          errorMessage: '법적 문서 종류가 올바르지 않습니다.',
          fieldName: 'kind',
        }),
      ),
    )
    parsedKind: LegalDocumentKind,
  ) {
    return this.legalService.getActiveDocument(parsedKind);
  }
}
