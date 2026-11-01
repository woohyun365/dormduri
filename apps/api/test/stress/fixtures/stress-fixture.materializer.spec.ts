/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from 'vitest';

import {
  assertStressFixtureApplyAllowed,
  STRESS_FIXTURE_APPLY_VALUE,
} from './stress-fixture.apply-guard.js';
import { createStressFixtureConfig } from './stress-fixture.config.js';
import {
  buildActorTokenPlan,
  buildMaterializationSummary,
  materializeStressFixture,
  resetStressFixture,
  type StressFixtureMutationClient,
} from './stress-fixture.materializer.js';
import { buildStressFixturePlan } from './stress-fixture.plan.js';

function model() {
  return {
    createMany: vi.fn((input: { data: unknown[] | Record<string, unknown> }) =>
      Promise.resolve({
        count: Array.isArray(input.data) ? input.data.length : 1,
      }),
    ),
    deleteMany: vi.fn(() => Promise.resolve({ count: 1 })),
    upsert: vi.fn(() => Promise.resolve({})),
  };
}

function createPrismaMock(): StressFixtureMutationClient {
  const prisma = {
    campusMaster: model(),
    collegeMaster: model(),
    dormitory: model(),
    season: model(),
    seasonDormitoryOperation: model(),
    user: model(),
    userDisplayIdentity: model(),
    userAcademicIdentity: model(),
    userAcademicIdentityChangeAllowance: model(),
    seasonParticipant: model(),
    seasonParticipantProfile: model(),
    seasonParticipantProfileHistory: model(),
    userBookmark: model(),
    matchRequest: model(),
    conversationThread: model(),
    conversationThreadMember: model(),
    conversationMessage: model(),
    chatRealtimeOutboxEvent: model(),
    chatRealtimeEventRecipient: model(),
    userNotification: model(),
    supportFaqArticle: model(),
    supportTicket: model(),
    supportTicketMessage: model(),
    reportCase: model(),
    reportCaseEvent: model(),
    authSession: model(),
    authSecurityEvent: model(),
    loginAttempt: model(),
    $transaction: vi.fn((callback: (tx: StressFixtureMutationClient) => Promise<unknown>) =>
      callback(prisma as unknown as StressFixtureMutationClient),
    ),
  };

  return prisma as unknown as StressFixtureMutationClient;
}

describe('stress fixture DB materializer', () => {
  it('requires explicit apply guard and still rejects production fixture mutation', () => {
    expect(() =>
      assertStressFixtureApplyAllowed({ STRESS_TARGET_URL: 'http://127.0.0.1:4000' }),
    ).toThrow('STRESS_FIXTURE_APPLY');

    expect(() =>
      assertStressFixtureApplyAllowed({
        STRESS_TARGET_URL: 'https://api.dormduri.example',
        STRESS_ENV: 'production',
        STRESS_ALLOW_PRODUCTION: 'I_UNDERSTAND',
        STRESS_FIXTURE_APPLY: STRESS_FIXTURE_APPLY_VALUE,
      }),
    ).toThrow('disabled for production targets');
  });

  it('summarizes high-load fixture rows without exposing secrets', () => {
    const plan = buildStressFixturePlan(
      createStressFixtureConfig({
        prefix: 'stress-materializer',
        largestCohortSize: 4,
        stressCohortSize: 12,
      }),
    );

    const summary = buildMaterializationSummary(plan);
    const tokenPlan = buildActorTokenPlan(plan);

    expect(summary.counts).toMatchObject({
      actors: 12,
      dormitories: 4,
      seasonDormitoryOperations: 4,
    });
    expect(summary.counts.bookmarks).toBeGreaterThan(0);
    expect(summary.counts.conversationThreads).toBeGreaterThan(0);
    expect(tokenPlan[0]).toMatchObject({
      actorId: 'stress-materializer-actor-0001',
      targetUserId: 'stress-materializer-user-0002',
    });
    expect(JSON.stringify(summary)).not.toContain('@stress.example.invalid');
  });

  it('materializes product rows through one transaction using hashed passwords', async () => {
    const plan = buildStressFixturePlan(
      createStressFixtureConfig({
        prefix: 'stress-materializer',
        largestCohortSize: 4,
        stressCohortSize: 12,
      }),
    );
    const prisma = createPrismaMock();

    await expect(
      materializeStressFixture(prisma, plan, {
        hashPassword: (password) => Promise.resolve(`hashed:${password}`),
        now: new Date('2026-08-05T06:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ mode: 'applied', databaseMutation: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.season.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          overrideState: 'SEASON_MATCHING',
          overrideStartedAt: new Date('2026-08-05T06:00:00.000Z'),
          overrideEndsAt: new Date('2026-08-06T06:00:00.000Z'),
        }),
        update: expect.objectContaining({
          overrideState: 'SEASON_MATCHING',
          overrideStartedAt: new Date('2026-08-05T06:00:00.000Z'),
          overrideEndsAt: new Date('2026-08-06T06:00:00.000Z'),
        }),
      }),
    );
    expect(prisma.user.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'stress-materializer-user-0001',
            passwordHash: 'hashed:stress-materializer-password-0001',
          }),
        ]),
        skipDuplicates: true,
      }),
    );
    expect(prisma.seasonParticipantProfile.createMany).toHaveBeenCalled();
    const profileCreateInput = vi.mocked(prisma.seasonParticipantProfile.createMany).mock
      .calls[0]?.[0];
    const profileRow = Array.isArray(profileCreateInput?.data)
      ? profileCreateInput.data[0]
      : profileCreateInput?.data;
    const profileRows = (
      Array.isArray(profileCreateInput?.data) ? profileCreateInput.data : []
    ) as Array<Record<string, unknown>>;
    expect(profileRow).toEqual(
      expect.not.objectContaining({
        seasonId: expect.anything(),
      }),
    );
    expect(profileRows.map((row) => row['grade'])).toContain('4+');
    expect(profileRows.every((row) => ['1', '2', '3', '4+'].includes(String(row['grade'])))).toBe(
      true,
    );

    expect(prisma.seasonParticipantProfileHistory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            participantId: 'stress-materializer-participant-0001',
            seasonId: 'stress-season-local',
          }),
        ]),
      }),
    );
    expect(prisma.conversationThread.createMany).toHaveBeenCalled();
  });

  it('reset deletes only marker-derived fixture rows in FK-safe order', async () => {
    const plan = buildStressFixturePlan(
      createStressFixtureConfig({
        prefix: 'stress-materializer',
        largestCohortSize: 4,
        stressCohortSize: 12,
      }),
    );
    const prisma = createPrismaMock();

    const summary = await resetStressFixture(prisma, plan);

    expect(summary.deleted.map((entry) => entry.model).slice(0, 7)).toEqual([
      'reportCaseEvent',
      'reportCase',
      'supportTicketMessage',
      'supportTicket',
      'supportFaqArticle',
      'userNotification',
      'chatRealtimeEventRecipient',
    ]);
    expect(prisma.reportCase.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([
          { id: { startsWith: 'stress-materializer' } },
          { reporterUserId: { in: expect.arrayContaining(['stress-materializer-user-0001']) } },
          { targetUserId: { in: expect.arrayContaining(['stress-materializer-user-0001']) } },
        ]),
      },
    });
    expect(prisma.userBookmark.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([
          { id: { startsWith: 'stress-materializer' } },
          { viewerUserId: { in: expect.arrayContaining(['stress-materializer-user-0001']) } },
          { targetUserId: { in: expect.arrayContaining(['stress-materializer-user-0001']) } },
        ]),
      },
    });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(['stress-materializer-user-0001']) } },
    });
    expect(prisma.dormitory.deleteMany).toHaveBeenCalledWith({
      where: { id: { startsWith: 'stress-materializer' } },
    });
  });
});
