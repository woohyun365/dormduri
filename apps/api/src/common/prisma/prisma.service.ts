import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { apiEnv } from '../../config/env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: apiEnv.databaseUrl }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.$executeRaw`SET TIME ZONE 'Asia/Seoul'`;
    await this.ensureUpdatedAtTriggers();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async ensureUpdatedAtTriggers() {
    await this.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION set_current_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const triggerTargets = [
      { trigger: 'set_user_updated_at', table: '"User"' },
      { trigger: 'set_login_attempt_updated_at', table: '"LoginAttempt"' },
      { trigger: 'set_auth_session_updated_at', table: '"AuthSession"' },
      { trigger: 'set_moderation_term_updated_at', table: '"ModerationTerm"' },
      { trigger: 'set_campus_master_updated_at', table: '"CampusMaster"' },
      { trigger: 'set_campus_guide_content_updated_at', table: '"CampusGuideContent"' },
      { trigger: 'set_dormitory_updated_at', table: '"Dormitory"' },
      { trigger: 'set_dormitory_guide_updated_at', table: '"DormitoryGuide"' },
      { trigger: 'set_season_updated_at', table: '"Season"' },
      { trigger: 'set_season_dormitory_operation_updated_at', table: '"SeasonDormitoryOperation"' },
    ];

    for (const target of triggerTargets) {
      await this.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${target.trigger} ON ${target.table}`);
      await this.$executeRawUnsafe(`
        CREATE TRIGGER ${target.trigger}
        BEFORE UPDATE ON ${target.table}
        FOR EACH ROW
        EXECUTE FUNCTION set_current_timestamp()
      `);
    }
  }
}
