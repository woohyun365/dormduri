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
import {
  API_CONFIG_FACTORIES,
  API_ENV_VALIDATION_SCHEMA,
} from './config/composition/api-config.registry.js';
import { ObservabilityModule } from './platform/observability/observability.module.js';
import { NoticesModule } from './notices/notices.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: API_CONFIG_FACTORIES,
      validationSchema: API_ENV_VALIDATION_SCHEMA,
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
    NoticesModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
