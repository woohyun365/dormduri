import { Injectable } from '@nestjs/common';
import {
  AuthCleanupMetricsService,
  type AuthCleanupMetricsSnapshot,
} from '../cleanup/auth-cleanup-metrics.service.js';

export interface AuthOperationsHealthSnapshot {
  cleanup: AuthCleanupMetricsSnapshot['cleanup'];
}

@Injectable()
export class AuthOperationsHealthService {
  constructor(private readonly metrics: AuthCleanupMetricsService) {}

  getSnapshot(): AuthOperationsHealthSnapshot {
    return this.metrics.snapshot();
  }
}
