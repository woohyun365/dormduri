import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { DormitoriesModule } from './dormitories/dormitories.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SeasonsModule } from './seasons/seasons.module.js';
import { UsersModule } from './users/users.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DormitoriesModule,
    SeasonsModule,
    UsersModule,
    ProfilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
