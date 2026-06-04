import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AppModule } from '../app.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthActorContextResolver } from '../auth/application/auth-actor-context.resolver.js';
import { AuthService } from '../auth/application/auth.service.js';
import { AuthenticatedUserGuard } from '../auth/access/authenticated-user.guard.js';
import { AuthOperationsHealthService } from '../auth/operations/auth-operations-health.service.js';
import { AuthOperationalCleanupService } from '../auth/operations/auth-operational-cleanup.service.js';
import { AuthOperationalMetricsService } from '../auth/operations/auth-operational-metrics.service.js';
import { AuthOperationsModule } from '../auth/operations/auth-operations.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { CHAT_LIFECYCLE_SWEEP_PORT } from '../chat/application/ports/chat-lifecycle-sweep.port.js';
import { CHAT_MATCH_THREAD_LIFECYCLE_PORT } from '../chat/application/ports/chat-match-thread-lifecycle.port.js';
import { CHAT_THREAD_WITHDRAWAL_PORT } from '../chat/application/ports/chat-thread-withdrawal.port.js';
import { ChatLifecycleModule } from '../chat/lifecycle/chat-lifecycle.module.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import { DormitoriesService } from '../dormitories/dormitories.service.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import { HealthModule } from '../health/health.module.js';
import { LifecycleModule } from '../lifecycle/lifecycle.module.js';
import { LifecycleSweepService } from '../lifecycle/lifecycle-sweep.service.js';
import { MatchesModule } from '../matches/matches.module.js';
import { MatchesService } from '../matches/matches.service.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CHAT_THREAD_NOTIFICATION_WRITER } from '../notifications/notifications.tokens.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationQueryService } from '../notifications/queries/notification-query.service.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  REALTIME_METRICS_READER_PORT,
  REALTIME_USER_ROOM_PUBLISHER_PORT,
} from '../realtime/realtime.tokens.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { CurrentSeasonParticipantContextGuard } from '../season-participants/current-season-participant-context.guard.js';
import { CurrentSeasonParticipationViewOwner } from '../season-participants/current-season-participation-view.owner.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { CurrentUserViewModule } from '../users/current-user-view.module.js';
import { CurrentUserViewService } from '../users/current-user-view.service.js';
import { UsersModule } from '../users/users.module.js';
import { UsersService } from '../users/users.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');

function moduleMetadata<T>(target: object, key: 'imports' | 'exports'): T[] {
  return (Reflect.getMetadata(key, target) ?? []) as T[];
}

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

function expectReadmeSections(path: string, sections: readonly string[]) {
  expect(existsSync(path)).toBe(true);
  const source = readSource(path);

  for (const section of sections) {
    expect(source).toContain(section);
  }

  return source;
}

describe('affected API module boundary finalization', () => {
  it('keeps app root imports explicit and avoids a CommonModule fallback', () => {
    const appSource = readSource(join(apiSourceRoot, 'app.module.ts'));

    expect(AppModule).toBeDefined();
    expect(appSource).toContain(
      "import { PrismaModule } from './platform/database/prisma.module.js'",
    );
    expect(appSource).toContain(
      "import { LifecycleModule } from './lifecycle/lifecycle.module.js'",
    );
    expect(appSource).not.toMatch(/CommonModule|from ['"].*common\//);
  });

  it('keeps affected modules on explicit owner imports after common removal', () => {
    expect(moduleMetadata(AuthModule, 'imports')).toEqual(
      expect.arrayContaining([PrismaModule, ModerationModule]),
    );
    expect(moduleMetadata(AuthOperationsModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(ChatModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        SeasonParticipantsModule,
        AuthModule,
        NotificationsModule,
        ChatLifecycleModule,
      ]),
    );
    expect(moduleMetadata(ChatLifecycleModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(MatchesModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        SeasonParticipantsModule,
        ChatModule,
        ModerationModule,
        AuthModule,
      ]),
    );
    expect(moduleMetadata(SeasonParticipantsModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        DormitoriesModule,
        AuthModule,
        ChatLifecycleModule,
      ]),
    );
    expect(moduleMetadata(ProfilesModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        SeasonParticipantsModule,
        MatchesModule,
        AuthModule,
      ]),
    );
    expect(moduleMetadata(UsersModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        CurrentUserViewModule,
        AuthModule,
        ModerationModule,
      ]),
    );
    expect(moduleMetadata(CurrentUserViewModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        SeasonsModule,
        SeasonParticipantsModule,
        MatchesModule,
      ]),
    );
    expect(moduleMetadata(NotificationsModule, 'imports')).toEqual([PrismaModule, AuthModule]);
    expect(moduleMetadata(HealthModule, 'imports')).toEqual([
      PrismaModule,
      ChatModule,
      AuthOperationsModule,
    ]);
    expect(moduleMetadata(LifecycleModule, 'imports')).toEqual(
      expect.arrayContaining([
        PrismaModule,
        AuthOperationsModule,
        ChatModule,
        MatchesModule,
        SeasonParticipantsModule,
        UsersModule,
      ]),
    );
    expect(moduleMetadata(ModerationModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(DormitoriesModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(SeasonsModule, 'imports')).toEqual([PrismaModule]);
  });

  it('keeps public exports as deliberate product surfaces and narrow ports', () => {
    expect(moduleMetadata(AuthModule, 'exports')).toEqual([
      AuthService,
      AuthActorContextResolver,
      AuthenticatedUserGuard,
    ]);
    expect(moduleMetadata(AuthOperationsModule, 'exports')).toEqual([
      AuthOperationalCleanupService,
      AuthOperationalMetricsService,
      AuthOperationsHealthService,
    ]);
    expect(moduleMetadata(ChatModule, 'exports')).toEqual([
      CHAT_MATCH_THREAD_LIFECYCLE_PORT,
      CHAT_LIFECYCLE_SWEEP_PORT,
      ChatLifecycleModule,
      REALTIME_DISPATCHER_CONFIG_PORT,
      REALTIME_DISPATCH_METRICS_PORT,
      REALTIME_METRICS_READER_PORT,
      REALTIME_USER_ROOM_PUBLISHER_PORT,
    ]);
    expect(moduleMetadata(ChatLifecycleModule, 'exports')).toEqual([CHAT_THREAD_WITHDRAWAL_PORT]);
    expect(moduleMetadata(MatchesModule, 'exports')).toEqual([MatchesService]);
    expect(moduleMetadata(SeasonParticipantsModule, 'exports')).toEqual([
      SeasonParticipantsService,
      CurrentSeasonParticipationViewOwner,
      CurrentSeasonParticipantContextGuard,
    ]);
    expect(moduleMetadata(UsersModule, 'exports')).toEqual([UsersService]);
    expect(moduleMetadata(CurrentUserViewModule, 'exports')).toEqual([CurrentUserViewService]);
    expect(moduleMetadata(ProfilesModule, 'exports')).toEqual([ProfilesService]);
    expect(moduleMetadata(NotificationsModule, 'exports')).toEqual([
      NotificationsService,
      NotificationQueryService,
      CHAT_THREAD_NOTIFICATION_WRITER,
    ]);
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual([
      DormitoriesService,
      DORMITORY_SELECTION_CATALOG_PORT,
    ]);
    expect(moduleMetadata(SeasonsModule, 'exports')).toEqual([SeasonsService]);
    expect(moduleMetadata(ModerationModule, 'exports')).toEqual([ModerationService]);
    expect(moduleMetadata(LifecycleModule, 'exports')).toEqual([LifecycleSweepService]);
    expect(moduleMetadata(HealthModule, 'exports')).toEqual([]);
  });

  it('keeps module wiring free of common imports, forwardRef, and hidden business globals', () => {
    expect(filesContaining(apiSourceRoot, /from\s+['"].*common\//)).toEqual([]);
    expect(filesContaining(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
    expect(filesContaining(apiSourceRoot, /@Global\s*\(\s*\)/)).toEqual([
      'src/platform/database/prisma.module.ts',
    ]);
  });

  it('documents final platform, lifecycle, and moderation product boundaries', () => {
    const requiredSections = [
      '## Public boundary',
      '## Directory responsibilities',
      '## Hard rules',
      '## Architecture guard',
      '## Where to change',
      '## Useful verification',
    ] as const;

    const platformReadme = expectReadmeSections(
      join(apiSourceRoot, 'platform/README.md'),
      requiredSections,
    );
    const lifecycleReadme = expectReadmeSections(
      join(apiSourceRoot, 'lifecycle/README.md'),
      requiredSections,
    );
    const moderationReadme = expectReadmeSections(
      join(apiSourceRoot, 'moderation/README.md'),
      requiredSections,
    );

    expect(platformReadme).toContain('neutral infrastructure/shared primitive');
    expect(platformReadme).toContain('PrismaModule');
    expect(platformReadme).toContain('platform production code는 제품 domain을 import하지 않는다');
    expect(lifecycleReadme).toContain('orchestration module');
    expect(lifecycleReadme).toContain('LifecycleSweepTaskPort');
    expect(lifecycleReadme).toContain('product policy를 직접 구현하지 않는다');
    expect(moderationReadme).toContain('business capability');
    expect(moderationReadme).toContain('ModerationService');
    expect(moderationReadme).toContain('non-global module');
  });
});
