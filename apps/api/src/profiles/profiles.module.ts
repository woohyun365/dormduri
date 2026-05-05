import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { UsersModule } from '../users/users.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    AuthModule,
    ModerationModule,
    UsersModule,
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
