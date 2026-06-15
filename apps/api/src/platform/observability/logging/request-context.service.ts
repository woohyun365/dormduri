import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ConfigType } from '@nestjs/config';
import observabilityConfig from '../../../config/observability.config.js';

export interface RequestContextStore {
  actorHash?: string;
  correlationId: string;
  requestId: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  constructor(
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {}

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): RequestContextStore | undefined {
    return this.storage.getStore();
  }

  setActor(actorId: string): void {
    const store = this.storage.getStore();
    if (!store) {
      return;
    }

    store.actorHash = this.hashIdentifier(actorId);
  }

  hashIdentifier(value: string): string {
    return createHmac('sha256', this.settings.logHashSecret).update(value).digest('hex');
  }
}
