import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { USERS_EXPORTS } from './composition/users.exports.js';
import { USERS_PROVIDERS } from './composition/users.providers.js';
import { CurrentUserViewModule } from './current-user/current-user-view.module.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [PrismaModule, SeasonsModule, CurrentUserViewModule, AuthModule, ModerationModule],
  controllers: [UsersController],
  providers: USERS_PROVIDERS,
  exports: USERS_EXPORTS,
})
export class UsersModule {}
