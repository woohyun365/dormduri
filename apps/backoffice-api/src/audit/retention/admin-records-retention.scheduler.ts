import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { AdminRecordsRetention } from './admin-records-retention.js';

const FIRST_RUN_DELAY_MS = 30_000;

/**
 * Runs the cleanup job on one timer inside the one backoffice API instance (README §5). A run never
 * overlaps the previous one in this process; overlapping containers during a rollout are safe
 * because every step is a conditional statement (see {@link AdminRecordsRetention}).
 */
export class AdminRecordsRetentionScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;
  private firstRun: NodeJS.Timeout | null = null;
  private running: Promise<unknown> | null = null;

  constructor(
    private readonly retention: AdminRecordsRetention,
    private readonly options: { enabled: boolean; intervalMs: number },
  ) {}

  onApplicationBootstrap(): void {
    if (!this.options.enabled) {
      return;
    }
    this.firstRun = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.firstRun.unref();
    this.interval = setInterval(() => void this.tick(), this.options.intervalMs);
    this.interval.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.firstRun) {
      clearTimeout(this.firstRun);
    }
    if (this.interval) {
      clearInterval(this.interval);
    }
    await this.running;
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = this.retention.runOnce().catch(() => undefined);
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }
}
