import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_FIXTURE_USERS } from '../../../apps/api/prisma/seed-data/fixtures/auth-fixture-users.js';

// Execute the real seed with a query recorder. Real SQL/idempotency is verified by full-stack DB runs.
async function recordSeed(mode, now = '2026-09-18T03:00:00.000Z') {
  const originalDate = globalThis.Date;
  const originalMode = process.env.HOME_E2E_SEED_MODE;
  globalThis.Date = class extends originalDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return new originalDate(now).getTime();
    }
  };
  process.env.HOME_E2E_SEED_MODE = mode;
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (/SELECT id, gender, campus/.test(sql)) {
        const user = AUTH_FIXTURE_USERS.find((u) => u.email.toLowerCase() === values[0]);
        assert.ok(user);
        return { rows: [{ id: user.key, gender: user.gender, campus: user.campus }] };
      }
      if (/SELECT id[\s\S]*FROM "Season"/.test(sql)) {
        return { rows: [{ id: `season-${values[0]}-${values[1] ?? 2}` }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  try {
    const { seedHomeDashboardE2eFixtures } = await import(
      `../../../apps/api/prisma/seed-data/fixtures/home-dashboard-e2e-fixtures.js?mode=${mode}`
    );
    await seedHomeDashboardE2eFixtures(client);
    return queries;
  } finally {
    globalThis.Date = originalDate;
    if (originalMode === undefined) delete process.env.HOME_E2E_SEED_MODE;
    else process.env.HOME_E2E_SEED_MODE = originalMode;
  }
}

function inserts(queries, table) {
  return queries
    .filter(({ sql }) => sql.includes(`INSERT INTO "${table}" (`))
    .map(({ sql, values }) => {
      const [, columns, expressions] = sql.match(
        /INSERT INTO "\w+" \(([\s\S]+?)\)\s*VALUES \(([\s\S]+?)\)\s*ON CONFLICT/,
      );
      const fields = columns.split(',').map((s) => s.trim().replaceAll('"', ''));
      const expressionsByField = expressions.split(',');
      return {
        sql,
        row: Object.fromEntries(
          fields.map((field, i) => {
            const expression = expressionsByField[i].trim();
            const parameter = expression.match(/^\$(\d+)/);
            return [field, parameter ? values[Number(parameter[1]) - 1] : expression];
          }),
        ),
      };
    });
}

for (const mode of ['current-matching', 'season-open', 'post-match', 'future-preview']) {
  test(`${mode}: complete registration fixture carries matching canonical snapshot, not incomplete`, async () => {
    const queries = await recordSeed(mode);
    const participants = inserts(queries, 'SeasonParticipant');
    const profiles = inserts(queries, 'SeasonParticipantProfile');
    const histories = inserts(queries, 'SeasonParticipantProfileHistory');
    const registered = participants.filter(({ row }) => row.participationIntent === 'REGISTERED');
    assert.equal(registered.length, 106); // 53 current + 53 past
    assert.equal(histories.length, registered.length);
    assert.equal(new Set(histories.map(({ row }) => row.id)).size, histories.length);
    for (const { row: participant, sql } of participants) {
      assert.match(sql, /"declinedAt" = NULL/);
      const { row: profile } = profiles.find(({ row }) => row.participantId === participant.id);
      assert.ok(profile.grade);
      assert.match(profile.mbti, /^[EI][NS][TF][JP]$/);
      const history = histories.find(({ row }) => row.participantId === participant.id);
      if (participant.participationIntent !== 'REGISTERED') {
        assert.equal(participant.id, 'home-e2e-incomplete-participant');
        assert.equal(participant.registeredAt, null);
        assert.equal(participant.participantStatus, 'DRAFT');
        assert.equal(history, undefined);
        continue;
      }
      assert.ok(history);
      assert.equal(history.row.id, `home-e2e-registration-${participant.id}`);
      assert.equal(history.row.seasonId, participant.seasonId);
      assert.equal(history.row.registeredAtSnapshot, participant.registeredAt);
      assert.match(history.sql, /ON CONFLICT \(id\)\s*DO UPDATE SET/);
      assert.match(history.sql, /'SEASON_REGISTRATION'/);
      for (const [key, value] of Object.entries(profile)) {
        if (['createdAt', 'updatedAt'].includes(key)) continue;
        assert.equal(history.row[key], value, key);
      }
    }
    assert.equal(
      queries.some(({ sql }) => /DELETE FROM "SeasonParticipantProfileHistory"/.test(sql)),
      false,
    );
    const again = inserts(await recordSeed(mode), 'SeasonParticipantProfileHistory');
    assert.deepEqual(
      again.map(({ row }) => row),
      histories.map(({ row }) => row),
    );
  });
}

for (const [now, expected] of [
  ['2026-09-18T03:00:00.000Z', ['2026-09-25', '2026-10-02', '2026-10-16', '2026-11-02']],
  ['2026-12-31T15:00:00.000Z', ['2027-01-08', '2027-01-15', '2027-01-29', '2027-02-15']],
  ['2026-12-31T14:59:59.999Z', ['2027-01-07', '2027-01-14', '2027-01-28', '2027-02-14']],
]) {
  test(`future-preview remains future across KST/year boundary: ${now}`, async () => {
    const queries = await recordSeed('future-preview', now);
    const { row: season } = inserts(queries, 'Season')[0];
    assert.equal(season.preparationStartDate, expected[0]);
    assert.equal(season.matchingStartDate, expected[1]);
    assert.equal(season.seasonEndDate, expected[3]);
    for (const { row } of inserts(queries, 'SeasonDormitoryOperation')) {
      assert.equal(row.roomSelectionDate, expected[2]);
    }
  });
}
