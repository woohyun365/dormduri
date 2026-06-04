import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { PrismaModule } from './platform/database/prisma.module.js';
import { DormitoriesModule } from './dormitories/dormitories.module.js';
import { HealthModule } from './health/health.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SeasonsModule } from './seasons/seasons.module.js';
import { UsersModule } from './users/users.module.js';
import { ApiExceptionFilter } from './platform/http/api-exception.filter.js';
import { MatchesModule } from './matches/matches.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { SeasonParticipantsModule } from './season-participants/season-participants.module.js';
import appConfig from './config/app.config.js';
import authConfig from './config/auth.config.js';
import authOperationsConfig from './config/auth-operations.config.js';
import chatRealtimeConfig from './config/chat-realtime.config.js';
import databaseConfig from './config/database.config.js';
import lifecycleConfig from './config/lifecycle.config.js';
import { envValidationSchema } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        authConfig,
        authOperationsConfig,
        chatRealtimeConfig,
        databaseConfig,
        lifecycleConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ChatModule,
    DormitoriesModule,
    HealthModule,
    SeasonsModule,
    SeasonParticipantsModule,
    UsersModule,
    ProfilesModule,
    MatchesModule,
    LifecycleModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
