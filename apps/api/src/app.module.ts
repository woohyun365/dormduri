import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { PrismaModule } from './platform/database/prisma.module.js';
import { DormitoriesModule } from './dormitories/dormitories.module.js';
import { HealthModule } from './health/health.module.js';
import { HomeDashboardModule } from './home-dashboard/home-dashboard.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { RoommateSearchModule } from './roommate-search/roommate-search.module.js';
import { SeasonsModule } from './seasons/seasons.module.js';
import { UsersModule } from './users/users.module.js';
import { ApiExceptionFilter } from './platform/http/api-exception.filter.js';
import { MatchesModule } from './matches/matches.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { LegalModule } from './legal/legal.module.js';
import { SeasonParticipantsModule } from './season-participants/season-participants.module.js';
import { SocialSafetyModule } from './social-safety/social-safety.module.js';
import { SupportModule } from './support/support.module.js';
import appConfig from './config/app.config.js';
import authConfig from './config/auth.config.js';
import authOperationsConfig from './config/auth-operations.config.js';
import chatRealtimeConfig from './config/chat-realtime.config.js';
import databaseConfig from './config/database.config.js';
import emailConfig from './config/email.config.js';
import httpConfig from './config/http.config.js';
import lifecycleConfig from './config/lifecycle.config.js';
import observabilityConfig from './config/observability.config.js';
import secretSourceConfig from './config/secret-source.config.js';
import { envValidationSchema } from './config/env.validation.js';
import { ObservabilityModule } from './platform/observability/observability.module.js';

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
        emailConfig,
        httpConfig,
        lifecycleConfig,
        observabilityConfig,
        secretSourceConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    ScheduleModule.forRoot(),
    ObservabilityModule,
    PrismaModule,
    AuthModule,
    ChatModule,
    DormitoriesModule,
    HealthModule,
    HomeDashboardModule,
    SeasonsModule,
    SeasonParticipantsModule,
    UsersModule,
    ProfilesModule,
    RoommateSearchModule,
    MatchesModule,
    LifecycleModule,
    LegalModule,
    SocialSafetyModule,
    SupportModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
