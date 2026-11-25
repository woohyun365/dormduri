import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { LegalService } from './application/legal.service.js';
import { LegalReconsentCommand } from './commands/legal-reconsent.command.js';
import { LegalConsentController } from './legal-consent.controller.js';
import { LegalController } from './legal.controller.js';
import { LEGAL_METRIC_DEFINITIONS } from './observability/legal-metric.definitions.js';
import { LegalDocumentQuery } from './queries/legal-document.query.js';
import { LegalPublishedVersionReader } from './queries/legal-published-version.reader.js';
import { LegalDocumentRepository } from './repositories/legal-document.repository.js';

@Module({
  imports: [
    PrismaModule,
    DomainMetricDefinitionsModule.register('legal', LEGAL_METRIC_DEFINITIONS),
  ],
  controllers: [LegalController, LegalConsentController],
  providers: [
    LegalService,
    LegalDocumentQuery,
    LegalPublishedVersionReader,
    LegalDocumentRepository,
    LegalReconsentCommand,
  ],
})
export class LegalModule {}
