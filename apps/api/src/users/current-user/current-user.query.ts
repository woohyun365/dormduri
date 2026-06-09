import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  buildUserWithDisplayIdentitySelect,
  mapUserWithDisplayIdentityProjection,
  type UserWithDisplayIdentityRecord,
} from './current-user.select.js';

@Injectable()
export class CurrentUserQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWithDisplayIdentity(userId: string): Promise<UserWithDisplayIdentityRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: buildUserWithDisplayIdentitySelect(),
    });

    if (!user) {
      throw new Error('[CurrentUserViewService] authenticated user not found');
    }

    return mapUserWithDisplayIdentityProjection(user);
  }
}
