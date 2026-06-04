import type { Logger } from '@nestjs/common';
import type { ManagedPrismaClient, PrismaService } from '../platform/database/prisma.service.js';
import type { RetentionObservabilityService } from '../retention/retention-observability.js';
import type { LifecycleSweepTaskPort } from './lifecycle-sweep-task.port.js';
import type {
  LifecycleSweepResult,
  LifecycleSweepTaskName,
  LifecycleSweepTaskResults,
} from './lifecycle-sweep.types.js';

interface LifecycleSweepRunnerDeps {
  prisma: PrismaService;
  retentionPrisma: ManagedPrismaClient;
  retentionObservability?: Pick<RetentionObservabilityService, 'emitSweep'>;
  tasks: readonly LifecycleSweepTaskPort[];
  logger?: Pick<Logger, 'error'>;
}

export function createLifecycleSweepRunner(deps: LifecycleSweepRunnerDeps) {
  const tasks = [...deps.tasks].sort((left, right) => left.order - right.order);

  async function runSweep(now?: Date): Promise<LifecycleSweepResult> {
    const startedAt = Date.now();
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const taskResults = {} as LifecycleSweepTaskResults;
    for (const task of tasks) {
      assignTaskResult(taskResults, task, await task.run(referenceNow));
    }

    const result = {
      ranAt: referenceNow.toISOString(),
      ...taskResults,
    } satisfies LifecycleSweepResult;

    try {
      await deps.retentionObservability?.emitSweep({
        prisma: deps.retentionPrisma,
        result,
        now: referenceNow,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      // Observability emission must never prevent lifecycle state convergence.
      deps.logger?.error(
        'Lifecycle retention observability emission failed',
        error instanceof Error ? error.stack : error,
      );
    }

    return result;
  }

  async function runPeriodicSweep(now?: Date): Promise<LifecycleSweepResult> {
    return runSweep(now);
  }

  async function runBoundarySweep(now?: Date): Promise<LifecycleSweepResult> {
    return runSweep(now);
  }

  return {
    runSweep,
    runPeriodicSweep,
    runBoundarySweep,
  };
}

function assignTaskResult<TName extends LifecycleSweepTaskName>(
  target: LifecycleSweepTaskResults,
  task: LifecycleSweepTaskPort<TName>,
  result: LifecycleSweepTaskResults[TName],
) {
  target[task.name] = result;
}
