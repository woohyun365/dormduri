import type { PrismaService } from '../../../src/platform/database/prisma.service.js';
import {
  capturePrismaQueryTrace,
  formatPrismaQueryTrace,
  type PrismaQueryTraceEvent,
} from './integration-query-trace.js';

export interface PrismaQueryBudget {
  maxQueries: number;
  maxTotalDurationMs?: number;
  ignorePatterns?: readonly RegExp[];
}

const defaultIgnoredQueryPatterns = [/^BEGIN$/i, /^COMMIT$/i, /^ROLLBACK$/i];

export async function expectPrismaQueryBudget<T>(
  prisma: PrismaService,
  label: string,
  action: () => Promise<T> | T,
  budget: PrismaQueryBudget,
): Promise<T> {
  const { result, events } = await capturePrismaQueryTrace(prisma, action);
  const countedEvents = filterCountedEvents(events, budget.ignorePatterns ?? []);
  const totalDurationMs = sumDurationMs(countedEvents);

  if (countedEvents.length > budget.maxQueries) {
    throw new Error(
      [
        `[integration-query-budget] ${label}: queryCount=${countedEvents.length} exceeded maxQueries=${budget.maxQueries}`,
        formatPrismaQueryTrace(`query-budget:${label}`, countedEvents),
      ].join('\n'),
    );
  }

  if (budget.maxTotalDurationMs !== undefined && totalDurationMs > budget.maxTotalDurationMs) {
    console.warn(
      `[integration-query-budget] ${label}: totalDurationMs=${totalDurationMs} exceeded diagnostic maxTotalDurationMs=${budget.maxTotalDurationMs}`,
    );
  }

  return result;
}

function filterCountedEvents(
  events: readonly PrismaQueryTraceEvent[],
  ignorePatterns: readonly RegExp[],
) {
  const patterns = [...defaultIgnoredQueryPatterns, ...ignorePatterns];

  return events.filter((event) => {
    const query = normalizeQuery(event.query);
    return patterns.every((pattern) => !pattern.test(query));
  });
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim();
}

function sumDurationMs(events: readonly PrismaQueryTraceEvent[]) {
  return events.reduce((sum, event) => sum + event.duration, 0);
}
