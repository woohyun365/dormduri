import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { CurrentUserViewModule } from './current-user-view.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, CurrentUserViewModule, AuthModule, ModerationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
