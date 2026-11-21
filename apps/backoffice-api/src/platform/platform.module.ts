import { Global, Module, type DynamicModule, type OnModuleDestroy } from '@nestjs/common';
import { BACKOFFICE_SETTINGS, type BackofficeSettings } from './config/backoffice-settings.js';
import {
  BackofficeRetentionPrisma,
  BackofficeRuntimePrisma,
} from './database/backoffice-prisma.js';
import { BackofficeLogger } from './observability/backoffice-logger.js';
import { BackofficeMetrics } from './observability/backoffice-metrics.js';
import { Clock } from './time/clock.js';

export interface PlatformOptions {
  readonly settings: BackofficeSettings;
  readonly clock: Clock;
  readonly logger: BackofficeLogger;
}

class DatabaseLifecycle implements OnModuleDestroy {
  constructor(private readonly clients: { close(): Promise<void> }[]) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.close()));
  }
}

/** Settings, the two database clients, clock, metrics and logger for every other module. */
@Global()
@Module({})
export class PlatformModule {
  static register(options: PlatformOptions): DynamicModule {
    const runtime = new BackofficeRuntimePrisma({
      url: options.settings.database.runtimeUrl,
      poolMax: options.settings.database.runtimePoolMax,
      applicationName: 'dormduri-backoffice-api',
    });
    const retention = new BackofficeRetentionPrisma({
      url: options.settings.database.retentionUrl,
      poolMax: options.settings.database.retentionPoolMax,
      applicationName: 'dormduri-backoffice-retention',
    });
    const providers = [
      { provide: BACKOFFICE_SETTINGS, useValue: options.settings },
      { provide: Clock, useValue: options.clock },
      { provide: BackofficeLogger, useValue: options.logger },
      { provide: BackofficeMetrics, useValue: new BackofficeMetrics(options.settings.env) },
      { provide: BackofficeRuntimePrisma, useValue: runtime },
      { provide: BackofficeRetentionPrisma, useValue: retention },
      { provide: DatabaseLifecycle, useValue: new DatabaseLifecycle([runtime, retention]) },
    ];
    return {
      module: PlatformModule,
      providers,
      exports: providers.map((provider) => provider.provide),
    };
  }
}
