import { AUTH_FIXTURE_USERS } from './auth-fixture-users.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const HOME_E2E_VIEWER_EMAIL = 'home-e2e-viewer@kangwon.ac.kr';
const HOME_E2E_REQUESTER_EMAIL = 'home-e2e-requester@kangwon.ac.kr';
const HOME_E2E_ACTIVE_COUNTERPART_EMAIL = 'home-e2e-active@kangwon.ac.kr';

const HOME_E2E_SEASON_NAME = 'Home full-stack smoke season';
const HOME_E2E_PARTICIPANTS = {
  viewer: 'home-e2e-viewer-participant',
  requester: 'home-e2e-requester-participant',
  activeCounterpart: 'home-e2e-active-counterpart-participant',
};
const HOME_E2E_PENDING_REQUEST_ID = 'home-e2e-pending-received-request';
const HOME_E2E_ACTIVE_REQUEST_ID = 'home-e2e-active-request';
const HOME_E2E_ACTIVE_MATCH_ID = 'home-e2e-active-match';
const HOME_E2E_THREAD_ID = 'home-e2e-active-thread';
const HOME_E2E_MESSAGE_ID = 'home-e2e-active-unread-message';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeNickname(nickname) {
  return nickname.trim().toLowerCase();
}

function toStoredLifestyleColumns(lifestyle) {
  return {
    bedtime: lifestyle.bedtime,
    wakeTime: lifestyle.wakeTime,
    sleepHabit: lifestyle.sleepHabit,
    sleepEnvironment: lifestyle.sleepEnvironment,
    screenUsage: lifestyle.screenUsage,
    noiseSensitivity: lifestyle.noiseSensitivity,
    smokingBehavior: lifestyle.smokingBehavior,
    indoorEating: lifestyle.indoorEating,
    phoneBehavior: lifestyle.phoneBehavior,
    earphoneUsage: lifestyle.earphoneUsage,
    cleanLevel: lifestyle.cleanLevel,
    drinkingFrequency: lifestyle.drinkingFrequency,
    relationshipStyle: lifestyle.relationshipStyle,
    temperatureSensitivity: lifestyle.temperatureSensitivity,
    smokingTolerance: lifestyle.smokingTolerance,
    phoneTolerance: lifestyle.phoneTolerance,
    earphoneExpectation: lifestyle.earphoneExpectation,
    sleepEnvPreference: lifestyle.sleepEnvPreference,
    screenTolerance: lifestyle.screenTolerance,
    indoorEatingTolerance: lifestyle.indoorEatingTolerance,
    cleanExpectation: lifestyle.cleanExpectation,
    drinkingTolerance: lifestyle.drinkingTolerance,
  };
}

function findAuthFixture(email) {
  const emailNormalized = normalizeEmail(email);
  const fixture = AUTH_FIXTURE_USERS.find((user) => normalizeEmail(user.email) === emailNormalized);

  if (!fixture) {
    throw new Error(`Home dashboard e2e auth fixture not found: ${email}`);
  }

  return fixture;
}

function toKstDateString(date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function buildPairKey(participantAId, participantBId) {
  return [participantAId, participantBId].sort().join(':');
}

async function findSeedUser(client, email) {
  const result = await client.query(
    `
      SELECT id, gender, campus
      FROM "User"
      WHERE "emailNormalized" = $1
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error(`Home dashboard e2e seed user not found: ${email}`);
  }

  return { ...user, fixture: findAuthFixture(email) };
}

async function upsertHomeSeason(client) {
  const now = new Date();
  const academicYear = Number.parseInt(toKstDateString(now).slice(0, 4), 10);
  const preparationStartDate = toKstDateString(addDays(now, -14));
  const matchingStartDate = toKstDateString(addDays(now, -1));
  const roomSelectionDate = toKstDateString(addDays(now, 14));
  const seasonEndDate = toKstDateString(addDays(now, 30));

  await client.query(
    `
      INSERT INTO "Season" (
        id,
        "campusCode",
        "academicYear",
        semester,
        name,
        "preparationStartDate",
        "matchingStartDate",
        "seasonEndDate",
        "overrideState",
        "overrideReason",
        "overrideStartedAt",
        "overrideEndsAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        'home-e2e-season',
        'CHUNCHEON'::"Campus",
        $1,
        2,
        $2,
        $3::date,
        $4::date,
        $5::date,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("campusCode", "academicYear", semester)
      DO UPDATE SET
        name = EXCLUDED.name,
        "preparationStartDate" = EXCLUDED."preparationStartDate",
        "matchingStartDate" = EXCLUDED."matchingStartDate",
        "seasonEndDate" = EXCLUDED."seasonEndDate",
        "overrideState" = NULL,
        "overrideReason" = NULL,
        "overrideStartedAt" = NULL,
        "overrideEndsAt" = NULL,
        "updatedAt" = NOW()
    `,
    [academicYear, HOME_E2E_SEASON_NAME, preparationStartDate, matchingStartDate, seasonEndDate],
  );

  const seasonResult = await client.query(
    `
      SELECT id
      FROM "Season"
      WHERE "campusCode" = 'CHUNCHEON'::"Campus"
        AND "academicYear" = $1
        AND semester = 2
      LIMIT 1
    `,
    [academicYear],
  );
  const seasonId = seasonResult.rows[0]?.id;
  if (!seasonId) {
    throw new Error('Home dashboard e2e season lookup failed');
  }

  for (const dormitoryId of ['dasan', 'yeji', 'saerom']) {
    await client.query(
      `
        INSERT INTO "SeasonDormitoryOperation" (
          "seasonId",
          "dormitoryId",
          "isOperated",
          "roomSelectionDate",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, TRUE, $3::date, NOW(), NOW())
        ON CONFLICT ("seasonId", "dormitoryId")
        DO UPDATE SET
          "isOperated" = TRUE,
          "roomSelectionDate" = EXCLUDED."roomSelectionDate",
          "updatedAt" = NOW()
      `,
      [seasonId, dormitoryId, roomSelectionDate],
    );
  }

  return seasonId;
}

async function upsertParticipant(client, { id, seasonId, user, status }) {
  await client.query(
    `
      INSERT INTO "SeasonParticipant" (
        id,
        "seasonId",
        "userId",
        "participationIntent",
        "registeredAt",
        "dormitoryId",
        "dormitorySelectionState",
        "participantStatus",
        "campusCodeSnapshot",
        "genderSnapshot",
        "joinedAt",
        "activatedAt",
        "matchedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        'REGISTERED'::"SeasonParticipationIntent",
        NOW(),
        'dasan',
        'ASSIGNED'::"DormitorySelectionState",
        $4::"ParticipantStatus",
        $5::"Campus",
        $6::"Gender",
        NOW(),
        NOW(),
        CASE WHEN $4::"ParticipantStatus" = 'MATCHED'::"ParticipantStatus" THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "userId" = EXCLUDED."userId",
        "participationIntent" = EXCLUDED."participationIntent",
        "registeredAt" = EXCLUDED."registeredAt",
        "dormitoryId" = EXCLUDED."dormitoryId",
        "dormitorySelectionState" = EXCLUDED."dormitorySelectionState",
        "participantStatus" = EXCLUDED."participantStatus",
        "campusCodeSnapshot" = EXCLUDED."campusCodeSnapshot",
        "genderSnapshot" = EXCLUDED."genderSnapshot",
        "activatedAt" = EXCLUDED."activatedAt",
        "matchedAt" = EXCLUDED."matchedAt",
        "withdrawnAt" = NULL,
        "expiredAt" = NULL,
        "hiddenByAdminAt" = NULL,
        "hiddenReasonCode" = NULL,
        "hiddenReasonDetail" = NULL,
        "deactivatedAt" = NULL,
        "updatedAt" = NOW()
    `,
    [id, seasonId, user.id, status, user.campus, user.gender],
  );

  const storedLifestyle = toStoredLifestyleColumns(user.fixture.lifestyle);
  const profileValues = [
    user.fixture.nickname,
    normalizeNickname(user.fixture.nickname),
    storedLifestyle.bedtime,
    storedLifestyle.wakeTime,
    storedLifestyle.sleepHabit,
    storedLifestyle.sleepEnvironment,
    storedLifestyle.screenUsage,
    storedLifestyle.noiseSensitivity,
    storedLifestyle.smokingBehavior,
    storedLifestyle.indoorEating,
    storedLifestyle.phoneBehavior,
    storedLifestyle.earphoneUsage,
    storedLifestyle.cleanLevel,
    storedLifestyle.drinkingFrequency,
    storedLifestyle.relationshipStyle,
    storedLifestyle.temperatureSensitivity,
    storedLifestyle.smokingTolerance,
    storedLifestyle.phoneTolerance,
    storedLifestyle.earphoneExpectation,
    storedLifestyle.sleepEnvPreference,
    storedLifestyle.screenTolerance,
    storedLifestyle.indoorEatingTolerance,
    storedLifestyle.cleanExpectation,
    storedLifestyle.drinkingTolerance,
    user.fixture.intro,
    user.fixture.college ?? 'IT',
    user.fixture.grade ?? null,
    user.fixture.mbti ?? null,
    user.fixture.birthYear ?? 2002,
  ];

  await client.query(
    `
      INSERT INTO "SeasonParticipantProfile" (
        "participantId",
        "nicknameSnapshot",
        "nicknameNormalizedSnapshot",
        bedtime,
        "wakeTime",
        "sleepHabit",
        "sleepEnvironment",
        "screenUsage",
        "noiseSensitivity",
        "smokingBehavior",
        "indoorEating",
        "phoneBehavior",
        "earphoneUsage",
        "cleanLevel",
        "drinkingFrequency",
        "relationshipStyle",
        "temperatureSensitivity",
        "smokingTolerance",
        "phoneTolerance",
        "earphoneExpectation",
        "sleepEnvPreference",
        "screenTolerance",
        "indoorEatingTolerance",
        "cleanExpectation",
        "drinkingTolerance",
        intro,
        "collegeCode",
        grade,
        mbti,
        "birthYear",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3,
        $4::"LifestyleBedtime", $5::"LifestyleWakeTime", $6::"LifestyleSleepHabit", $7::"LifestyleSleepEnvironment",
        $8::"LifestyleScreenUsage", $9::"LifestyleNoiseSensitivity", $10::"LifestyleSmokingBehavior", $11::"LifestyleIndoorEating",
        $12::"LifestylePhoneBehavior", $13::"LifestyleEarphoneUsage", $14::"LifestyleCleanLevel", $15::"LifestyleDrinkingFrequency",
        $16::"LifestyleRelationshipStyle", $17::"LifestyleTemperatureSensitivity", $18::"RoommateSmokingTolerance", $19::"RoommatePhoneTolerance",
        $20::"RoommateEarphoneExpectation", $21::"RoommateSleepEnvPreference", $22::"RoommateScreenTolerance", $23::"RoommateIndoorEatingTolerance",
        $24::"RoommateCleanExpectation", $25::"RoommateDrinkingTolerance",
        $26, $27, $28, $29, $30, NOW(), NOW()
      )
      ON CONFLICT ("participantId")
      DO UPDATE SET
        "nicknameSnapshot" = EXCLUDED."nicknameSnapshot",
        "nicknameNormalizedSnapshot" = EXCLUDED."nicknameNormalizedSnapshot",
        bedtime = EXCLUDED.bedtime,
        "wakeTime" = EXCLUDED."wakeTime",
        "sleepHabit" = EXCLUDED."sleepHabit",
        "sleepEnvironment" = EXCLUDED."sleepEnvironment",
        "screenUsage" = EXCLUDED."screenUsage",
        "noiseSensitivity" = EXCLUDED."noiseSensitivity",
        "smokingBehavior" = EXCLUDED."smokingBehavior",
        "indoorEating" = EXCLUDED."indoorEating",
        "phoneBehavior" = EXCLUDED."phoneBehavior",
        "earphoneUsage" = EXCLUDED."earphoneUsage",
        "cleanLevel" = EXCLUDED."cleanLevel",
        "drinkingFrequency" = EXCLUDED."drinkingFrequency",
        "relationshipStyle" = EXCLUDED."relationshipStyle",
        "temperatureSensitivity" = EXCLUDED."temperatureSensitivity",
        "smokingTolerance" = EXCLUDED."smokingTolerance",
        "phoneTolerance" = EXCLUDED."phoneTolerance",
        "earphoneExpectation" = EXCLUDED."earphoneExpectation",
        "sleepEnvPreference" = EXCLUDED."sleepEnvPreference",
        "screenTolerance" = EXCLUDED."screenTolerance",
        "indoorEatingTolerance" = EXCLUDED."indoorEatingTolerance",
        "cleanExpectation" = EXCLUDED."cleanExpectation",
        "drinkingTolerance" = EXCLUDED."drinkingTolerance",
        intro = EXCLUDED.intro,
        "collegeCode" = EXCLUDED."collegeCode",
        grade = EXCLUDED.grade,
        mbti = EXCLUDED.mbti,
        "birthYear" = EXCLUDED."birthYear",
        "updatedAt" = NOW()
    `,
    [id, ...profileValues],
  );
}

async function upsertMatchRequest(client, input) {
  const pairKey = buildPairKey(input.requesterParticipantId, input.receiverParticipantId);
  const [pairMinParticipantId, pairMaxParticipantId] = pairKey.split(':');

  await client.query(
    `
      INSERT INTO "MatchRequest" (
        id,
        "seasonId",
        "pairKey",
        "pairMinParticipantId",
        "pairMaxParticipantId",
        "requesterParticipantId",
        "receiverParticipantId",
        note,
        status,
        "terminalReason",
        "createdAt",
        "expiresAt",
        "terminalAt",
        "acceptedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::"MatchRequestStatus",
        $10::"MatchRequestTerminalReason",
        $11::timestamptz,
        $12::timestamptz,
        $13::timestamptz,
        $14::timestamptz
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "pairKey" = EXCLUDED."pairKey",
        "pairMinParticipantId" = EXCLUDED."pairMinParticipantId",
        "pairMaxParticipantId" = EXCLUDED."pairMaxParticipantId",
        "requesterParticipantId" = EXCLUDED."requesterParticipantId",
        "receiverParticipantId" = EXCLUDED."receiverParticipantId",
        note = EXCLUDED.note,
        status = EXCLUDED.status,
        "terminalReason" = EXCLUDED."terminalReason",
        "createdAt" = EXCLUDED."createdAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "terminalAt" = EXCLUDED."terminalAt",
        "acceptedAt" = EXCLUDED."acceptedAt"
    `,
    [
      input.id,
      input.seasonId,
      pairKey,
      pairMinParticipantId,
      pairMaxParticipantId,
      input.requesterParticipantId,
      input.receiverParticipantId,
      input.note ?? null,
      input.status,
      input.terminalReason ?? null,
      input.createdAt.toISOString(),
      input.expiresAt.toISOString(),
      input.terminalAt?.toISOString() ?? null,
      input.acceptedAt?.toISOString() ?? null,
    ],
  );
}

async function seedHomeDashboardE2eFixtures(client) {
  const seasonId = await upsertHomeSeason(client);
  const viewer = await findSeedUser(client, HOME_E2E_VIEWER_EMAIL);
  const requester = await findSeedUser(client, HOME_E2E_REQUESTER_EMAIL);
  const activeCounterpart = await findSeedUser(client, HOME_E2E_ACTIVE_COUNTERPART_EMAIL);

  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.viewer,
    seasonId,
    user: viewer,
    status: 'MATCHED',
  });
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.requester,
    seasonId,
    user: requester,
    status: 'ACTIVE',
  });
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.activeCounterpart,
    seasonId,
    user: activeCounterpart,
    status: 'MATCHED',
  });

  const now = new Date();
  await upsertMatchRequest(client, {
    id: HOME_E2E_PENDING_REQUEST_ID,
    seasonId,
    requesterParticipantId: HOME_E2E_PARTICIPANTS.requester,
    receiverParticipantId: HOME_E2E_PARTICIPANTS.viewer,
    note: '홈 스모크 pending 요청입니다.',
    status: 'PENDING',
    createdAt: addHours(now, -2),
    expiresAt: addHours(now, 48),
  });
  await upsertMatchRequest(client, {
    id: HOME_E2E_ACTIVE_REQUEST_ID,
    seasonId,
    requesterParticipantId: HOME_E2E_PARTICIPANTS.viewer,
    receiverParticipantId: HOME_E2E_PARTICIPANTS.activeCounterpart,
    note: '홈 스모크 active match 요청입니다.',
    status: 'ACCEPTED',
    terminalReason: 'ACCEPTED',
    createdAt: addHours(now, -5),
    expiresAt: addHours(now, 24),
    terminalAt: addHours(now, -4),
    acceptedAt: addHours(now, -4),
  });

  const activePairKey = buildPairKey(
    HOME_E2E_PARTICIPANTS.viewer,
    HOME_E2E_PARTICIPANTS.activeCounterpart,
  );
  const [activePairMinParticipantId, activePairMaxParticipantId] = activePairKey.split(':');

  await client.query(
    `
      INSERT INTO "ActiveMatch" (
        id,
        "seasonId",
        "pairKey",
        "participantAId",
        "participantBId",
        "createdFromRequestId",
        status,
        "startedAt",
        "endedAt",
        "endReason",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE'::"ActiveMatchStatus", $7::timestamptz, NULL, NULL, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "pairKey" = EXCLUDED."pairKey",
        "participantAId" = EXCLUDED."participantAId",
        "participantBId" = EXCLUDED."participantBId",
        "createdFromRequestId" = EXCLUDED."createdFromRequestId",
        status = EXCLUDED.status,
        "startedAt" = EXCLUDED."startedAt",
        "endedAt" = NULL,
        "endReason" = NULL,
        "updatedAt" = NOW()
    `,
    [
      HOME_E2E_ACTIVE_MATCH_ID,
      seasonId,
      activePairKey,
      activePairMinParticipantId,
      activePairMaxParticipantId,
      HOME_E2E_ACTIVE_REQUEST_ID,
      addHours(now, -4).toISOString(),
    ],
  );

  await client.query(
    `
      INSERT INTO "ConversationThread" (
        id,
        "seasonId",
        "pairKey",
        "participantAId",
        "participantBId",
        "openedByParticipantId",
        "threadKind",
        "activeMatchId",
        status,
        "closedReason",
        "closedAt",
        "lastMessageAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $4,
        'MATCHED'::"ConversationThreadKind",
        $6,
        'OPEN'::"ConversationThreadStatus",
        NULL,
        NULL,
        $7::timestamptz,
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "pairKey" = EXCLUDED."pairKey",
        "participantAId" = EXCLUDED."participantAId",
        "participantBId" = EXCLUDED."participantBId",
        "openedByParticipantId" = EXCLUDED."openedByParticipantId",
        "threadKind" = EXCLUDED."threadKind",
        "activeMatchId" = EXCLUDED."activeMatchId",
        status = EXCLUDED.status,
        "closedReason" = NULL,
        "closedAt" = NULL,
        "lastMessageAt" = EXCLUDED."lastMessageAt",
        "updatedAt" = NOW()
    `,
    [
      HOME_E2E_THREAD_ID,
      seasonId,
      activePairKey,
      activePairMinParticipantId,
      activePairMaxParticipantId,
      HOME_E2E_ACTIVE_MATCH_ID,
      addHours(now, -1).toISOString(),
    ],
  );

  const memberRows = [
    {
      participantId: HOME_E2E_PARTICIPANTS.viewer,
      lastReadAt: addHours(now, -2).toISOString(),
    },
    {
      participantId: HOME_E2E_PARTICIPANTS.activeCounterpart,
      lastReadAt: addHours(now, -1).toISOString(),
    },
  ];

  for (const row of memberRows) {
    await client.query(
      `
        INSERT INTO "ConversationThreadMember" (
          "threadId",
          "participantId",
          "memberState",
          "leftAt",
          "mutedAt",
          "lastReadAt",
          "lastReadMessageId",
          "lastVisibleAt",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, 'ACTIVE'::"ConversationThreadMemberState", NULL, NULL, $3::timestamptz, NULL, $3::timestamptz, NOW(), NOW())
        ON CONFLICT ("threadId", "participantId")
        DO UPDATE SET
          "memberState" = EXCLUDED."memberState",
          "leftAt" = NULL,
          "mutedAt" = NULL,
          "lastReadAt" = EXCLUDED."lastReadAt",
          "lastReadMessageId" = NULL,
          "lastVisibleAt" = EXCLUDED."lastVisibleAt",
          "updatedAt" = NOW()
      `,
      [HOME_E2E_THREAD_ID, row.participantId, row.lastReadAt],
    );
  }

  await client.query(
    `
      INSERT INTO "ConversationMessage" (
        id,
        "threadId",
        "senderParticipantId",
        "clientMessageId",
        body,
        "bodyState",
        "sentAt",
        "deletedAt",
        "createdAt"
      )
      VALUES ($1, $2, $3, NULL, $4, 'PLAIN'::"ConversationMessageBodyState", $5::timestamptz, NULL, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        "threadId" = EXCLUDED."threadId",
        "senderParticipantId" = EXCLUDED."senderParticipantId",
        body = EXCLUDED.body,
        "bodyState" = EXCLUDED."bodyState",
        "sentAt" = EXCLUDED."sentAt",
        "deletedAt" = NULL
    `,
    [
      HOME_E2E_MESSAGE_ID,
      HOME_E2E_THREAD_ID,
      HOME_E2E_PARTICIPANTS.activeCounterpart,
      '홈 스모크 unread 메시지입니다.',
      addHours(now, -1).toISOString(),
    ],
  );

  console.log('[seed] home dashboard e2e fixture ready');
}

export { seedHomeDashboardE2eFixtures };
