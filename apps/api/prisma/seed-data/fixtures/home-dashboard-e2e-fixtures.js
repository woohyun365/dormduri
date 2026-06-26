import { AUTH_FIXTURE_USERS, HOME_E2E_MATRIX_USERS } from './auth-fixture-users.js';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const HOME_E2E_VIEWER_EMAIL = 'home-e2e-viewer@kangwon.ac.kr';
const HOME_E2E_REQUESTER_EMAIL = 'home-e2e-requester@kangwon.ac.kr';
const HOME_E2E_ACTIVE_COUNTERPART_EMAIL = 'home-e2e-active@kangwon.ac.kr';
const HOME_E2E_HISTORY_EMAIL = 'home-e2e-history@kangwon.ac.kr';
const HOME_E2E_INCOMPLETE_EMAIL = 'home-e2e-incomplete@kangwon.ac.kr';

const HOME_E2E_SEED_MODE = process.env.HOME_E2E_SEED_MODE ?? 'current-matching';
const HOME_E2E_SUPPORTED_SEED_MODES = new Set([
  'current-matching',
  'season-open',
  'post-match',
  'future-preview',
]);
const HOME_E2E_CURRENT_SEASON = {
  id: 'home-e2e-season',
  academicYear: 2026,
  semester: 2,
  name: '2026년 2학기 Home full-stack smoke',
};
const HOME_E2E_PAST_SEASON = {
  academicYear: 2026,
  semester: 1,
  name: '2026년 1학기',
};
const HOME_E2E_NEXT_SEASON = {
  academicYear: 2026,
  semester: 2,
  name: '2026년 2학기',
  preparationStartDate: '2026-08-20',
  matchingStartDate: '2026-09-01',
  roomSelectionDate: '2026-09-15',
  seasonEndDate: '2026-12-20',
};
const HOME_E2E_DORMITORY_MATRIX = [
  { dormitoryId: 'dasan', expectedMinimumParticipants: 10 },
  { dormitoryId: 'yeji', expectedMinimumParticipants: 10 },
  { dormitoryId: 'saerom', expectedMinimumParticipants: 10 },
  { dormitoryId: 'irum', expectedMinimumParticipants: 10 },
  { dormitoryId: 'daon', expectedMinimumParticipants: 10 },
];
const HOME_E2E_PARTICIPANTS = {
  viewer: 'home-e2e-viewer-participant',
  requester: 'home-e2e-requester-participant',
  activeCounterpart: 'home-e2e-active-counterpart-participant',
  pastViewer: 'home-e2e-past-viewer-participant',
  pastCounterpart: 'home-e2e-past-counterpart-participant',
  pastHistoryOnly: 'home-e2e-past-history-only-participant',
  incomplete: 'home-e2e-incomplete-participant',
};
const HOME_E2E_PENDING_REQUEST_ID = 'home-e2e-pending-received-request';
const HOME_E2E_ACTIVE_REQUEST_ID = 'home-e2e-active-request';
const HOME_E2E_ACTIVE_MATCH_ID = 'home-e2e-active-match';
const HOME_E2E_THREAD_ID = 'home-e2e-active-thread';
const HOME_E2E_MESSAGE_ID = 'home-e2e-active-unread-message';
const HOME_E2E_PAST_MATCH_REQUEST_ID = 'home-e2e-past-match-request';
const HOME_E2E_PAST_ACTIVE_MATCH_ID = 'home-e2e-past-active-match';
const HOME_E2E_PAST_HISTORY_VIEWER_ID = 'home-e2e-past-history-viewer-entry';
const HOME_E2E_PAST_HISTORY_COUNTERPART_ID = 'home-e2e-past-history-counterpart-entry';

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

function getSeedMode() {
  if (!HOME_E2E_SUPPORTED_SEED_MODES.has(HOME_E2E_SEED_MODE)) {
    throw new Error(
      `Unsupported HOME_E2E_SEED_MODE: ${HOME_E2E_SEED_MODE}. Supported modes: ${[
        ...HOME_E2E_SUPPORTED_SEED_MODES,
      ].join(', ')}`,
    );
  }

  return HOME_E2E_SEED_MODE;
}

function getCurrentSeasonSchedule(now, mode) {
  if (mode === 'future-preview') {
    return {
      preparationStartDate: HOME_E2E_NEXT_SEASON.preparationStartDate,
      matchingStartDate: HOME_E2E_NEXT_SEASON.matchingStartDate,
      roomSelectionDate: HOME_E2E_NEXT_SEASON.roomSelectionDate,
      seasonEndDate: HOME_E2E_NEXT_SEASON.seasonEndDate,
    };
  }

  if (mode === 'season-open') {
    return {
      preparationStartDate: toKstDateString(addDays(now, -1)),
      matchingStartDate: toKstDateString(addDays(now, 14)),
      roomSelectionDate: toKstDateString(addDays(now, 28)),
      seasonEndDate: toKstDateString(addDays(now, 45)),
    };
  }

  if (mode === 'post-match') {
    return {
      preparationStartDate: toKstDateString(addDays(now, -45)),
      matchingStartDate: toKstDateString(addDays(now, -30)),
      roomSelectionDate: toKstDateString(addDays(now, -1)),
      seasonEndDate: toKstDateString(addDays(now, 14)),
    };
  }

  return {
    preparationStartDate: toKstDateString(addDays(now, -14)),
    matchingStartDate: toKstDateString(addDays(now, -1)),
    roomSelectionDate: toKstDateString(addDays(now, 14)),
    seasonEndDate: toKstDateString(addDays(now, 30)),
  };
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
  const mode = getSeedMode();
  const schedule = getCurrentSeasonSchedule(now, mode);

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
        $1,
        'CHUNCHEON'::"Campus",
        $2,
        2,
        $3,
        $4::date,
        $5::date,
        $6::date,
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
    [
      HOME_E2E_CURRENT_SEASON.id,
      HOME_E2E_CURRENT_SEASON.academicYear,
      mode === 'future-preview' ? HOME_E2E_NEXT_SEASON.name : HOME_E2E_CURRENT_SEASON.name,
      schedule.preparationStartDate,
      schedule.matchingStartDate,
      schedule.seasonEndDate,
    ],
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
    [HOME_E2E_CURRENT_SEASON.academicYear],
  );
  const seasonId = seasonResult.rows[0]?.id;
  if (!seasonId) {
    throw new Error('Home dashboard e2e season lookup failed');
  }

  for (const { dormitoryId } of HOME_E2E_DORMITORY_MATRIX) {
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
      [seasonId, dormitoryId, schedule.roomSelectionDate],
    );
  }

  return seasonId;
}

async function upsertParticipant(
  client,
  {
    id,
    seasonId,
    user,
    status,
    dormitoryId = user.fixture.dormitoryId ?? 'dasan',
    dormitorySelectionState = user.fixture.dormitorySelectionState ?? 'ASSIGNED',
    participationIntent = 'REGISTERED',
    registeredAt = new Date(),
  },
) {
  const joinedAt = registeredAt ?? new Date();
  const activatedAt = status === 'ACTIVE' || status === 'MATCHED' ? joinedAt : null;

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
        $4::"SeasonParticipationIntent",
        $5::timestamptz,
        $6,
        $7::"DormitorySelectionState",
        $8::"ParticipantStatus",
        $9::"Campus",
        $10::"Gender",
        $11::timestamptz,
        $12::timestamptz,
        CASE WHEN $8::"ParticipantStatus" = 'MATCHED'::"ParticipantStatus" THEN $12::timestamptz ELSE NULL END,
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
        "joinedAt" = EXCLUDED."joinedAt",
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
    [
      id,
      seasonId,
      user.id,
      participationIntent,
      registeredAt?.toISOString() ?? null,
      dormitoryId,
      dormitorySelectionState,
      status,
      user.campus,
      user.gender,
      joinedAt.toISOString(),
      activatedAt?.toISOString() ?? null,
    ],
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

async function lookupSeedSeason(client, { academicYear, semester }) {
  const result = await client.query(
    `
      SELECT id
      FROM "Season"
      WHERE "campusCode" = 'CHUNCHEON'::"Campus"
        AND "academicYear" = $1
        AND semester = $2
      LIMIT 1
    `,
    [academicYear, semester],
  );
  const seasonId = result.rows[0]?.id;

  if (!seasonId) {
    throw new Error(`Home dashboard e2e seed season not found: ${academicYear}-${semester}`);
  }

  return seasonId;
}

async function upsertDormitoryMatrixParticipants(client, seasonId, { idPrefix, registeredAt }) {
  for (const seedUser of HOME_E2E_MATRIX_USERS) {
    const user = await findSeedUser(client, seedUser.email);
    await upsertParticipant(client, {
      id: `${idPrefix}-${seedUser.key}`,
      seasonId,
      user,
      status: 'ACTIVE',
      dormitoryId: seedUser.dormitoryId,
      dormitorySelectionState: 'ASSIGNED',
      registeredAt,
    });
  }
}

async function upsertSeasonMatchHistoryEntry(
  client,
  {
    id,
    seasonId,
    viewerParticipantId,
    counterpartParticipantId,
    viewerRequested,
    sourceRequestId,
    sourceActiveMatchId,
    counterpartNicknameSnapshot,
    viewerDormitoryIdSnapshot,
    finalizedAt,
  },
) {
  const pairKey = buildPairKey(viewerParticipantId, counterpartParticipantId);

  await client.query(
    `
      INSERT INTO "SeasonMatchHistoryEntry" (
        id,
        "seasonId",
        "viewerParticipantId",
        "counterpartParticipantId",
        "pairKey",
        "entryType",
        "entryResult",
        "viewerRequested",
        "sourceRequestId",
        "sourceActiveMatchId",
        "createdFromRequestId",
        "counterpartNicknameSnapshot",
        "counterpartRedactedAt",
        "viewerRedactedAt",
        "viewerDormitoryIdSnapshot",
        "matchedAt",
        "unmatchedAt",
        "finalizedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'MATCH'::"SeasonMatchHistoryEntryType",
        'MATCHED_SUCCESS'::"SeasonMatchHistoryEntryResult",
        $6,
        $7,
        $8,
        $7,
        $9,
        NULL,
        NULL,
        $10,
        $11::timestamptz,
        NULL,
        $11::timestamptz,
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "viewerParticipantId" = EXCLUDED."viewerParticipantId",
        "counterpartParticipantId" = EXCLUDED."counterpartParticipantId",
        "pairKey" = EXCLUDED."pairKey",
        "entryType" = EXCLUDED."entryType",
        "entryResult" = EXCLUDED."entryResult",
        "viewerRequested" = EXCLUDED."viewerRequested",
        "sourceRequestId" = EXCLUDED."sourceRequestId",
        "sourceActiveMatchId" = EXCLUDED."sourceActiveMatchId",
        "createdFromRequestId" = EXCLUDED."createdFromRequestId",
        "counterpartNicknameSnapshot" = EXCLUDED."counterpartNicknameSnapshot",
        "counterpartRedactedAt" = NULL,
        "viewerRedactedAt" = NULL,
        "viewerDormitoryIdSnapshot" = EXCLUDED."viewerDormitoryIdSnapshot",
        "matchedAt" = EXCLUDED."matchedAt",
        "unmatchedAt" = NULL,
        "finalizedAt" = EXCLUDED."finalizedAt",
        "updatedAt" = NOW()
    `,
    [
      id,
      seasonId,
      viewerParticipantId,
      counterpartParticipantId,
      pairKey,
      viewerRequested,
      sourceRequestId,
      sourceActiveMatchId,
      counterpartNicknameSnapshot,
      viewerDormitoryIdSnapshot,
      finalizedAt.toISOString(),
    ],
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

async function seedPastSeasonHistoryFixtures(client) {
  const pastSeasonId = await lookupSeedSeason(client, HOME_E2E_PAST_SEASON);
  const viewer = await findSeedUser(client, HOME_E2E_VIEWER_EMAIL);
  const activeCounterpart = await findSeedUser(client, HOME_E2E_ACTIVE_COUNTERPART_EMAIL);
  const historyOnlyViewer = await findSeedUser(client, HOME_E2E_HISTORY_EMAIL);
  const registeredAt = new Date('2026-01-15T03:00:00.000Z');
  const finalizedAt = new Date('2026-02-20T03:00:00.000Z');

  await upsertDormitoryMatrixParticipants(client, pastSeasonId, {
    idPrefix: 'home-e2e-past-matrix',
    registeredAt,
  });
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.pastViewer,
    seasonId: pastSeasonId,
    user: viewer,
    status: 'MATCHED',
    dormitoryId: 'dasan',
    registeredAt,
  });
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.pastCounterpart,
    seasonId: pastSeasonId,
    user: activeCounterpart,
    status: 'MATCHED',
    dormitoryId: 'dasan',
    registeredAt,
  });
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.pastHistoryOnly,
    seasonId: pastSeasonId,
    user: historyOnlyViewer,
    status: 'ACTIVE',
    dormitoryId: 'dasan',
    registeredAt,
  });

  await upsertMatchRequest(client, {
    id: HOME_E2E_PAST_MATCH_REQUEST_ID,
    seasonId: pastSeasonId,
    requesterParticipantId: HOME_E2E_PARTICIPANTS.pastViewer,
    receiverParticipantId: HOME_E2E_PARTICIPANTS.pastCounterpart,
    note: '홈 스모크 지난 시즌 성공 요청입니다.',
    status: 'ACCEPTED',
    terminalReason: 'ACCEPTED',
    createdAt: addHours(finalizedAt, -12),
    expiresAt: addHours(finalizedAt, 12),
    terminalAt: finalizedAt,
    acceptedAt: finalizedAt,
  });

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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'SEASON_ENDED'::"ActiveMatchStatus",
        $7::timestamptz,
        $8::timestamptz,
        'SEASON_ENDED'::"ActiveMatchEndReason",
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        "seasonId" = EXCLUDED."seasonId",
        "pairKey" = EXCLUDED."pairKey",
        "participantAId" = EXCLUDED."participantAId",
        "participantBId" = EXCLUDED."participantBId",
        "createdFromRequestId" = EXCLUDED."createdFromRequestId",
        status = EXCLUDED.status,
        "startedAt" = EXCLUDED."startedAt",
        "endedAt" = EXCLUDED."endedAt",
        "endReason" = EXCLUDED."endReason",
        "updatedAt" = NOW()
    `,
    [
      HOME_E2E_PAST_ACTIVE_MATCH_ID,
      pastSeasonId,
      buildPairKey(HOME_E2E_PARTICIPANTS.pastViewer, HOME_E2E_PARTICIPANTS.pastCounterpart),
      HOME_E2E_PARTICIPANTS.pastViewer,
      HOME_E2E_PARTICIPANTS.pastCounterpart,
      HOME_E2E_PAST_MATCH_REQUEST_ID,
      finalizedAt.toISOString(),
      finalizedAt.toISOString(),
    ],
  );

  await upsertSeasonMatchHistoryEntry(client, {
    id: HOME_E2E_PAST_HISTORY_VIEWER_ID,
    seasonId: pastSeasonId,
    viewerParticipantId: HOME_E2E_PARTICIPANTS.pastViewer,
    counterpartParticipantId: HOME_E2E_PARTICIPANTS.pastCounterpart,
    viewerRequested: true,
    sourceRequestId: HOME_E2E_PAST_MATCH_REQUEST_ID,
    sourceActiveMatchId: HOME_E2E_PAST_ACTIVE_MATCH_ID,
    counterpartNicknameSnapshot: activeCounterpart.fixture.nickname,
    viewerDormitoryIdSnapshot: 'dasan',
    finalizedAt,
  });
  await upsertSeasonMatchHistoryEntry(client, {
    id: HOME_E2E_PAST_HISTORY_COUNTERPART_ID,
    seasonId: pastSeasonId,
    viewerParticipantId: HOME_E2E_PARTICIPANTS.pastCounterpart,
    counterpartParticipantId: HOME_E2E_PARTICIPANTS.pastViewer,
    viewerRequested: false,
    sourceRequestId: HOME_E2E_PAST_MATCH_REQUEST_ID,
    sourceActiveMatchId: HOME_E2E_PAST_ACTIVE_MATCH_ID,
    counterpartNicknameSnapshot: viewer.fixture.nickname,
    viewerDormitoryIdSnapshot: 'dasan',
    finalizedAt,
  });
}

async function seedHomeDashboardE2eFixtures(client) {
  const seasonId = await upsertHomeSeason(client);
  const viewer = await findSeedUser(client, HOME_E2E_VIEWER_EMAIL);
  const requester = await findSeedUser(client, HOME_E2E_REQUESTER_EMAIL);
  const activeCounterpart = await findSeedUser(client, HOME_E2E_ACTIVE_COUNTERPART_EMAIL);
  const incompleteViewer = await findSeedUser(client, HOME_E2E_INCOMPLETE_EMAIL);

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
  await upsertParticipant(client, {
    id: HOME_E2E_PARTICIPANTS.incomplete,
    seasonId,
    user: incompleteViewer,
    status: 'DRAFT',
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
  });
  await upsertDormitoryMatrixParticipants(client, seasonId, {
    idPrefix: 'home-e2e-current-matrix',
    registeredAt: new Date(),
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

  await seedPastSeasonHistoryFixtures(client);

  console.log(
    `[seed] home dashboard e2e fixture ready (mode: ${getSeedMode()}, operated dormitories: ${HOME_E2E_DORMITORY_MATRIX.length})`,
  );
}

export {
  HOME_E2E_CURRENT_SEASON,
  HOME_E2E_DORMITORY_MATRIX,
  HOME_E2E_NEXT_SEASON,
  HOME_E2E_PAST_SEASON,
  seedHomeDashboardE2eFixtures,
};
