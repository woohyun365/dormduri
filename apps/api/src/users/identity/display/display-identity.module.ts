import { Module } from '@nestjs/common';
import { ModerationModule } from '../../../moderation/moderation.module.js';
import { PrismaModule } from '../../../platform/database/prisma.module.js';
import { DisplayIdentityNicknamePolicyService } from './display-identity-nickname-policy.service.js';
import { DisplayIdentityRepository } from './display-identity.repository.js';

@Module({
  imports: [PrismaModule, ModerationModule],
  providers: [DisplayIdentityRepository, DisplayIdentityNicknamePolicyService],
  exports: [DisplayIdentityRepository, DisplayIdentityNicknamePolicyService],
})
export class DisplayIdentityModule {}
