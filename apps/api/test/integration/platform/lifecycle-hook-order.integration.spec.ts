import { afterEach, describe, expect, it } from 'vitest';
import { AuthMailDispatcherService } from '../../../src/auth/mail/auth-mail-dispatcher.service.js';
import { ChatRealtimeDispatcherService } from '../../../src/chat/realtime/chat-realtime-dispatcher.service.js';
import { LifecycleSweepService } from '../../../src/lifecycle/lifecycle-sweep.service.js';
import { NotificationOutboxDispatcherService } from '../../../src/notifications/outbox/notification-dispatcher.service.js';
import { ManagedPrismaClient } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from '../_support/integration-app.js';
import { createIntegrationDatabaseSandbox } from '../_support/integration-db.js';
import { cleanupIntegrationTestResources } from '../_support/integration-suite.js';

// Background workers poll the database through the Prisma clients. They must start after every client has
// connected and stop before any client disconnects. NestJS orders lifecycle hooks by module and component
// hierarchy, so this pins the order the API relies on across framework upgrades.
const WORKERS = [
  AuthMailDispatcherService,
  ChatRealtimeDispatcherService,
  NotificationOutboxDispatcherService,
  LifecycleSweepService,
] as const;

const restores: Array<() => void> = [];

function recordHook(prototype: object, method: string, label: string, events: string[]) {
  const original = Reflect.get(prototype, method) as (this: unknown, ...args: unknown[]) => unknown;
  Reflect.set(prototype, method, async function (this: unknown, ...args: unknown[]) {
    const name = label === 'prisma' ? (this as object).constructor.name : label;
    events.push(`${name}:${method}:begin`);
    await original.apply(this, args);
    events.push(`${name}:${method}:end`);
  });
  restores.push(() => Reflect.set(prototype, method, original));
}

function indices(events: string[], suffix: string, names: readonly string[]) {
  return events.flatMap((event, index) =>
    names.some((name) => event === `${name}:${suffix}`) ? [index] : [],
  );
}

describe('API lifecycle hook order', () => {
  afterEach(() => {
    while (restores.length > 0) restores.pop()?.();
  });

  it('starts workers after the Prisma clients connect and stops them before the clients disconnect', async () => {
    const events: string[] = [];
    recordHook(ManagedPrismaClient.prototype, 'onModuleInit', 'prisma', events);
    recordHook(ManagedPrismaClient.prototype, 'onModuleDestroy', 'prisma', events);
    for (const worker of WORKERS) {
      recordHook(worker.prototype, 'onApplicationBootstrap', worker.name, events);
      recordHook(worker.prototype, 'onModuleDestroy', worker.name, events);
    }

    const sandbox = await createIntegrationDatabaseSandbox('lifecycle_hook_order');
    const { app } = await createIntegrationApp().catch(async (error: unknown) => {
      await sandbox.cleanup();
      throw error;
    });
    await cleanupIntegrationTestResources({
      closeApp: () => app.close(),
      cleanupDatabase: () => sandbox.cleanup(),
    });

    const prismaClients = [
      'PrismaService',
      'RetentionWorkerPrismaService',
      'RetentionDisclosurePrismaService',
    ];
    const workers = WORKERS.map((worker) => worker.name);
    expect(indices(events, 'onModuleInit:end', prismaClients)).toHaveLength(prismaClients.length);
    expect(indices(events, 'onModuleDestroy:begin', prismaClients)).toHaveLength(
      prismaClients.length,
    );
    expect(indices(events, 'onApplicationBootstrap:begin', workers)).toHaveLength(workers.length);
    expect(indices(events, 'onModuleDestroy:end', workers)).toHaveLength(workers.length);

    expect(Math.max(...indices(events, 'onModuleInit:end', prismaClients))).toBeLessThan(
      Math.min(...indices(events, 'onApplicationBootstrap:begin', workers)),
    );
    expect(Math.max(...indices(events, 'onModuleDestroy:end', workers))).toBeLessThan(
      Math.min(...indices(events, 'onModuleDestroy:begin', prismaClients)),
    );
  });
});
