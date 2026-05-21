import type { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/common/prisma/prisma.service.js';

interface QueryTraceState {
  active: boolean;
  events: Prisma.QueryEvent[];
  installed: boolean;
}

const QUERY_TRACE_STATES = new WeakMap<PrismaService, QueryTraceState>();

type QueryTraceablePrisma = PrismaService & {
  $on(eventType: 'query', callback: (event: Prisma.QueryEvent) => void): PrismaService;
};

export async function withPrismaQueryTraceOnFailure<T>(
  prisma: PrismaService,
  testName: string,
  action: () => Promise<T> | T,
): Promise<T> {
  const state = ensureQueryTraceState(prisma);
  state.events = [];
  state.active = true;

  try {
    return await action();
  } catch (error) {
    printQueryTrace(testName, state.events);
    throw error;
  } finally {
    state.active = false;
  }
}

function ensureQueryTraceState(prisma: PrismaService): QueryTraceState {
  const existing = QUERY_TRACE_STATES.get(prisma);
  if (existing) {
    return existing;
  }

  const state: QueryTraceState = {
    active: false,
    events: [],
    installed: false,
  };
  QUERY_TRACE_STATES.set(prisma, state);

  (prisma as QueryTraceablePrisma).$on('query', (event) => {
    if (!state.active) {
      return;
    }
    state.events.push(event);
  });
  state.installed = true;

  return state;
}

function printQueryTrace(testName: string, events: Prisma.QueryEvent[]) {
  const maxEvents = 80;
  const visibleEvents = events.slice(-maxEvents);
  const omitted = Math.max(events.length - visibleEvents.length, 0);
  const lines = [
    `[integration-query-trace] ${testName}`,
    `[integration-query-trace] captured=${events.length} shown=${visibleEvents.length} omitted=${omitted}`,
    ...visibleEvents.map((event, index) =>
      [
        `#${index + 1 + omitted}`,
        `${event.duration}ms`,
        event.query.replace(/\s+/g, ' ').trim(),
        '[params redacted]',
      ].join(' | '),
    ),
  ];

  console.error(lines.join('\n'));
}
