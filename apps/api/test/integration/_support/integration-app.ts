import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createHttpAdapter } from '../../../src/platform/http/http-adapter.js';

export interface IntegrationAppContext {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createIntegrationApp(): Promise<IntegrationAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication(createHttpAdapter(false));
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
  };
}
