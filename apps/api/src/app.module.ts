import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ChatModule } from './chat/chat.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { DormitoriesModule } from './dormitories/dormitories.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SeasonsModule } from './seasons/seasons.module.js';
import { UsersModule } from './users/users.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { MatchesModule } from './matches/matches.module.js';
import { LifecycleSweepService } from './common/lifecycle/lifecycle-sweep.service.js';
import { SeasonParticipantsModule } from './season-participants/season-participants.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ChatModule,
    DormitoriesModule,
    SeasonsModule,
    SeasonParticipantsModule,
    UsersModule,
    ProfilesModule,
    MatchesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LifecycleSweepService,
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
