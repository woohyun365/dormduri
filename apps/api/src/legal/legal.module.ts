import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { LegalService } from './application/legal.service.js';
import { LegalDocumentQuery } from './queries/legal-document.query.js';
import { LegalDocumentRepository } from './repositories/legal-document.repository.js';
import { LegalController } from './legal.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [LegalController],
  providers: [LegalService, LegalDocumentQuery, LegalDocumentRepository],
})
export class LegalModule {}
