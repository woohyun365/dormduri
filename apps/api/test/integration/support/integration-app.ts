import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module.js';
import { PrismaService } from '../../../src/common/prisma/prisma.service.js';

export interface IntegrationAppContext {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createIntegrationApp(): Promise<IntegrationAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
  };
}
