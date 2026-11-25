import { randomUUID } from 'node:crypto';
import {
  accessRequestListResponseSchema,
  legalBackofficeVersionDetailSchema,
  legalDecisionResponseSchema,
  legalDocumentsOverviewResponseSchema,
  legalDraftDetailResponseSchema,
  legalDraftListResponseSchema,
  legalDraftSchema,
  legalRequestDetailResponseSchema,
  legalRequestListResponseSchema,
  legalRequestSchema,
  type LegalDraft,
  type LegalRequest,
} from '@repo/shared/backoffice';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  bootstrapOwner,
  inviteOperator,
  loginWithPasskey,
  reauthenticate,
  startBackofficeTestApp,
  type BackofficeTestApp,
  type RegisteredOperator,
} from '../support/backoffice-test-app.js';
import {
  createIntegrationSandbox,
  type IntegrationSandbox,
} from '../support/integration-database.js';

type Kind =
  | 'TERMS_OF_SERVICE'
  | 'PRIVACY_POLICY'
  | 'PERSONAL_DATA_COLLECTION_USE_CONSENT'
  | 'AGE_14_OR_ABOVE_NOTICE';

const DAY_MS = 24 * 60 * 60_000;
const SECTIONS = [
  { type: 'heading', level: 2, text: '제1조(목적)' },
  { type: 'paragraph', text: '이 문서는 시험 문서입니다.' },
];

function addDays(versionKey: string, days: number): string {
  const date = new Date(`${versionKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Backoffice legal publication against real PostgreSQL as `dormduri_backoffice`.
 * The scenarios share one sandbox and run in order: each kind's versions build
 * on the steps before. Notice dates count from the database's KST date, which also decides approval.
 */
describe('backoffice legal publication (OA-R9)', () => {
  let sandbox: IntegrationSandbox;
  let test: BackofficeTestApp;
  let owner: RegisteredOperator;
  let legalApprover: RegisteredOperator | null = null;
  let today: string;

  const fresh = async (operator: RegisteredOperator): Promise<RegisteredOperator> => {
    const next = { ...operator, token: await loginWithPasskey(test, operator) };
    await reauthenticate(test, next);
    return next;
  };

  const draftBody = (kind: Kind, overrides: Record<string, unknown> = {}) => ({
    kind,
    contentSchemaVersion: 1,
    title: '시험 문서',
    summaryItems: ['요약'],
    sections: SECTIONS,
    changeSummary: '시험 변경',
    noticeClass: 'GENERAL',
    consentRequired: false,
    proposedEffectiveDate: addDays(today, 7),
    ...overrides,
  });

  // Every response is parsed with the shared contract the BFF parses it with.
  const createDraft = async (
    kind: Kind,
    overrides: Record<string, unknown> = {},
    author = owner,
  ): Promise<LegalDraft> => {
    const response = await test.http
      .post('/legal/drafts')
      .set(bearer(author.token))
      .send({ source: 'editor', draft: draftBody(kind, overrides) })
      .expect(200);
    return legalDraftSchema.parse(response.body);
  };

  const saveDraft = (
    draft: { id: string; revision: number },
    kind: Kind,
    overrides: Record<string, unknown> = {},
  ) =>
    test.http
      .put(`/legal/drafts/${draft.id}`)
      .set(bearer(owner.token))
      .send({ revision: draft.revision, draft: draftBody(kind, overrides) });

  const discard = (draft: { id: string; revision: number }) =>
    test.http
      .post(`/legal/drafts/${draft.id}/discard`)
      .set(bearer(owner.token))
      .send({ revision: draft.revision });

  const requestPublish = async (draft: LegalDraft, requester = owner): Promise<LegalRequest> => {
    const response = await test.http
      .post(`/legal/drafts/${draft.id}/publish-requests`)
      .set(bearer(requester.token))
      .send({ revision: draft.revision })
      .expect(200);
    return legalRequestSchema.parse(response.body);
  };

  const read = (path: string) => test.http.get(path).set(bearer(owner.token));

  const listDrafts = async (query: string) =>
    legalDraftListResponseSchema.parse((await read(`/legal/drafts?${query}`).expect(200)).body);

  /** The approval screen data, whose `check` names the rule a decision would refuse. */
  const detailOf = async (request: { id: string }) =>
    legalRequestDetailResponseSchema.parse(
      (await read(`/legal/requests/${request.id}`).expect(200)).body,
    );

  const approve = (
    request: { id: string; contentDigest: string },
    approver = owner,
    reason: string | undefined = 'sole approver',
  ) =>
    test.http
      .post(`/legal/requests/${request.id}/approve`)
      .set(bearer(approver.token))
      .send({ contentDigest: request.contentDigest, ...(reason === undefined ? {} : { reason }) });

  const cancel = (request: { id: string }, requester = owner) =>
    test.http.post(`/legal/requests/${request.id}/cancel`).set(bearer(requester.token)).send({});

  /** Draft, request, the check the approval screen shows and the decision in one step. */
  const publish = async (kind: Kind, overrides: Record<string, unknown> = {}) => {
    const draft = await createDraft(kind, overrides);
    const request = await requestPublish(draft);
    const { check } = await detailOf(request);
    return { draft, request, check, decision: await approve(request) };
  };

  const decided = (response: { body: unknown }) => legalDecisionResponseSchema.parse(response.body);

  const draftStatus = async (draftId: string): Promise<string> => {
    const { rows } = await sandbox.admin.query<{ status: string }>(
      `SELECT "status" FROM ${sandbox.table('LegalDocumentDraft')} WHERE "id" = $1`,
      [draftId],
    );
    return rows[0]!.status;
  };

  const versionsOf = async (kind: Kind) => {
    const { rows } = await sandbox.admin.query<{ noticeClass: string; withdrawnAt: Date | null }>(
      `SELECT "noticeClass", "withdrawnAt" FROM ${sandbox.table('LegalDocumentVersion')}
       WHERE "kind" = $1 ORDER BY "effectiveDate"`,
      [kind],
    );
    return rows;
  };

  beforeAll(async () => {
    sandbox = await createIntegrationSandbox('bo_legal');
    test = await startBackofficeTestApp(sandbox);
    owner = await bootstrapOwner(test);
    const { rows } = await sandbox.admin.query<{ today: string }>(
      `SELECT to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS "today"`,
    );
    today = rows[0]!.today;
  });

  afterAll(async () => {
    await test?.close();
    await sandbox?.cleanup();
  });

  beforeEach(async () => {
    test.clock.advance(61_000);
    owner = await fresh(owner);
  });

  it('leaves a legal request row out of the role request list and decisions', async () => {
    const draftId = randomUUID();
    const requestId = randomUUID();
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('LegalDocumentDraft')}
         ("id", "kind", "title", "summaryItems", "sections", "changeSummary", "noticeClass",
          "proposedEffectiveDate", "status", "authorAccountId")
       VALUES ($1, 'PRIVACY_POLICY', 'row', '[]', $2::jsonb, 'row', 'GENERAL', $3::date,
               'PENDING_APPROVAL', $4)`,
      [draftId, JSON.stringify(SECTIONS), addDays(today, 30), owner.accountId],
    );
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('AdminApprovalRequest')}
         ("id", "kind", "contentDigest", "targetLegalDraftId", "requestedByAccountId", "expiresAt")
       VALUES ($1, 'LEGAL_PUBLISH', $2, $3, $4, now() + interval '7 days')`,
      [requestId, 'e'.repeat(64), draftId, owner.accountId],
    );
    try {
      const list = await test.http.get('/access/requests').set(bearer(owner.token)).expect(200);
      const parsed = accessRequestListResponseSchema.safeParse(list.body);
      expect(parsed.success).toBe(true);
      expect(parsed.data?.requests.map((row) => row.id)).not.toContain(requestId);
      const decided = await test.http
        .post(`/access/requests/${requestId}/approve`)
        .set(bearer(owner.token))
        .send({ contentDigest: 'e'.repeat(64), reason: 'role path' });
      expect(decided.status).toBe(404);
    } finally {
      await sandbox.admin.query(
        `UPDATE ${sandbox.table('AdminApprovalRequest')} SET "status" = 'CANCELLED', "closedAt" = now() WHERE "id" = $1 AND "status" = 'PENDING'`,
        [requestId],
      );
      await sandbox.admin.query(
        `UPDATE ${sandbox.table('LegalDocumentDraft')} SET "status" = 'DISCARDED' WHERE "id" = $1`,
        [draftId],
      );
    }
  });

  it('refuses the legal routes to an account without a legal permission', async () => {
    const operator = await inviteOperator(test, owner, 'auditor@backoffice.test');
    const grant = await test.http
      .post('/access/requests')
      .set(bearer(owner.token))
      .send({ kind: 'ROLE_GRANT', targetAccountId: operator.accountId, targetRole: 'AUDITOR' })
      .expect(200);
    await test.http
      .post(`/access/requests/${grant.body.id as string}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: grant.body.contentDigest as string, reason: 'auditor setup' })
      .expect(200);
    const auditor = await fresh(operator);

    for (const [method, path] of [
      ['get', '/legal/documents'],
      ['get', '/legal/drafts'],
      ['post', '/legal/drafts'],
      ['get', '/legal/requests'],
      ['post', `/legal/requests/${randomUUID()}/approve`],
    ] as const) {
      const denied = await test.http[method](path).set(bearer(auditor.token)).send({});
      expect(denied.status, `${method} ${path}`).toBe(403);
      expect(denied.body.error.code).toBe('permission_denied');
    }
    const anonymous = await test.http.get('/legal/documents');
    expect(anonymous.status).toBe(401);
    // The owner role holds both legal permissions.
    await test.http.get('/legal/documents').set(bearer(owner.token)).expect(200);
  });

  it('takes a historical record only with an end before the approval date, then the first publication right after it', async () => {
    const missingEnd = await test.http
      .post('/legal/drafts')
      .set(bearer(owner.token))
      .send({
        source: 'import',
        draft: draftBody('PRIVACY_POLICY', {
          noticeClass: 'HISTORICAL',
          proposedEffectiveDate: addDays(today, -200),
        }),
      });
    expect(missingEnd.status).toBe(400);
    expect(missingEnd.body.error.code).toBe('invalid_request');

    const notBefore = await publish('PRIVACY_POLICY', {
      noticeClass: 'HISTORICAL',
      proposedEffectiveDate: addDays(today, -200),
      appliesUntil: today,
    });
    expect(notBefore.check).toEqual({ ok: false, reason: 'historical_not_before_approval' });
    expect(notBefore.decision.status).toBe(409);
    expect(notBefore.decision.body.error.code).toBe('conflict');
    await cancel(notBefore.request).expect(200);

    const saved = await saveDraft(notBefore.draft, 'PRIVACY_POLICY', {
      noticeClass: 'HISTORICAL',
      proposedEffectiveDate: addDays(today, -200),
      appliesUntil: addDays(today, -10),
    }).expect(200);
    const historical = await approve(await requestPublish(legalDraftSchema.parse(saved.body)));
    expect(historical.status).toBe(200);
    expect(decided(historical).version).toMatchObject({
      kind: 'PRIVACY_POLICY',
      noticeClass: 'HISTORICAL',
      effectiveDate: addDays(today, -200),
      appliesUntil: addDays(today, -10),
      withdrawnAt: null,
      requestedByAccountId: owner.accountId,
      approvedByAccountId: owner.accountId,
      selfApproved: true,
    });

    // A historical record whose end changed after the request no longer matches the request digest.
    const second = await createDraft('PRIVACY_POLICY', {
      noticeClass: 'HISTORICAL',
      proposedEffectiveDate: addDays(today, -400),
      appliesUntil: addDays(today, -300),
    });
    const secondRequest = await requestPublish(second);
    await sandbox.admin.query(
      `UPDATE ${sandbox.table('LegalDocumentDraft')} SET "appliesUntil" = $2::date WHERE "id" = $1`,
      [second.id, addDays(today, -250)],
    );
    // The checks pass on the changed content; the decision refuses the digest, not a date rule.
    expect((await detailOf(secondRequest)).check).toEqual({ ok: true });
    const changed = await approve(secondRequest);
    expect(changed.status).toBe(409);
    await cancel(secondRequest).expect(200);

    const notNextDay = await publish('PRIVACY_POLICY', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -8),
    });
    expect(notNextDay.check).toEqual({ ok: false, reason: 'initial_not_after_history' });
    expect(notNextDay.decision.status).toBe(409);
    await cancel(notNextDay.request).expect(200);

    const initial = await publish('PRIVACY_POLICY', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -9),
    });
    expect(initial.check).toEqual({ ok: true });
    expect(initial.decision.status).toBe(200);
    expect(await draftStatus(initial.draft.id)).toBe('PUBLISHED');
    // A published draft is closed: it is not saved, asked for again or discarded.
    await saveDraft(initial.draft, 'PRIVACY_POLICY', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -9),
    }).expect(409);
    await test.http
      .post(`/legal/drafts/${initial.draft.id}/publish-requests`)
      .set(bearer(owner.token))
      .send({ revision: initial.draft.revision })
      .expect(409);
    await discard(initial.draft).expect(409);
    expect(await draftStatus(initial.draft.id)).toBe('PUBLISHED');

    for (const noticeClass of ['HISTORICAL', 'INITIAL'] as const) {
      const again = await publish('PRIVACY_POLICY', {
        noticeClass,
        proposedEffectiveDate: addDays(today, -500),
        ...(noticeClass === 'HISTORICAL' ? { appliesUntil: addDays(today, -450) } : {}),
      });
      expect(again.check, noticeClass).toEqual({ ok: false, reason: 'first_publication_exists' });
      expect(again.decision.status, noticeClass).toBe(409);
      await cancel(again.request).expect(200);
    }
    expect((await versionsOf('PRIVACY_POLICY')).map((row) => row.noticeClass)).toEqual([
      'HISTORICAL',
      'INITIAL',
    ]);
  });

  it('needs seven days of notice for a general version and thirty for a significant one', async () => {
    const early = await publish('TERMS_OF_SERVICE', { proposedEffectiveDate: addDays(today, 7) });
    // No first publication yet: a revision has nothing to follow.
    expect(early.check).toEqual({ ok: false, reason: 'first_publication_required' });
    expect(early.decision.status).toBe(409);
    await cancel(early.request).expect(200);
    const afterToday = await publish('TERMS_OF_SERVICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, 1),
    });
    expect(afterToday.check).toEqual({ ok: false, reason: 'initial_after_approval' });
    expect(afterToday.decision.status).toBe(409);
    await cancel(afterToday.request).expect(200);
    expect(
      (
        await publish('TERMS_OF_SERVICE', {
          noticeClass: 'INITIAL',
          proposedEffectiveDate: addDays(today, -30),
        })
      ).decision.status,
    ).toBe(200);

    const sixDays = await publish('TERMS_OF_SERVICE', { proposedEffectiveDate: addDays(today, 6) });
    expect(sixDays.check).toEqual({ ok: false, reason: 'notice_too_short' });
    expect(sixDays.decision.status).toBe(409);
    await cancel(sixDays.request).expect(200);
    const significant = { noticeClass: 'SIGNIFICANT', consentRequired: true };
    const twentyNine = await publish('TERMS_OF_SERVICE', {
      ...significant,
      proposedEffectiveDate: addDays(today, 29),
    });
    expect(twentyNine.check).toEqual({ ok: false, reason: 'notice_too_short' });
    expect(twentyNine.decision.status).toBe(409);
    await cancel(twentyNine.request).expect(200);
    const thirty = await publish('TERMS_OF_SERVICE', {
      ...significant,
      proposedEffectiveDate: addDays(today, 30),
    });
    expect(thirty.decision.status).toBe(200);

    // A second first publication and a second scheduled version of the kind are refused.
    const secondInitial = await publish('TERMS_OF_SERVICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -60),
    });
    // The policy refuses it before the partial unique index would.
    expect(secondInitial.check).toEqual({ ok: false, reason: 'first_publication_exists' });
    expect(secondInitial.decision.status).toBe(409);
    await cancel(secondInitial.request).expect(200);
    const secondScheduled = await publish('TERMS_OF_SERVICE', {
      proposedEffectiveDate: addDays(today, 40),
    });
    expect(secondScheduled.check).toEqual({ ok: false, reason: 'scheduled_version_exists' });
    expect(secondScheduled.decision.status).toBe(409);
    await cancel(secondScheduled.request).expect(200);
    expect(await test.metrics.render()).toMatch(
      /backoffice_legal_decisions_total\{(?=[^}]*decision="publish_approved")(?=[^}]*kind="TERMS_OF_SERVICE")(?=[^}]*notice_class="SIGNIFICANT")[^}]*\} 1/u,
    );
  });

  it('refuses significant and reconsent versions while a member can receive mail', async () => {
    expect(
      (
        await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
          noticeClass: 'INITIAL',
          proposedEffectiveDate: addDays(today, -30),
        })
      ).decision.status,
    ).toBe(200);
    const userId = randomUUID();
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('User')} ("id", "email", "emailNormalized", "passwordHash", "gender", "campus")
       VALUES ($1, $2, $2, 'hash', 'M', 'CHUNCHEON')`,
      [userId, `${userId}@member.test`],
    );
    try {
      // A privacy policy never asks for reconsent: the significant class alone needs zero members.
      const privacy = await publish('PRIVACY_POLICY', {
        noticeClass: 'SIGNIFICANT',
        proposedEffectiveDate: addDays(today, 30),
      });
      expect(privacy.check).toEqual({ ok: false, reason: 'members_exist' });
      expect(privacy.decision.status).toBe(409);
      await cancel(privacy.request).expect(200);
      const significant = await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
        noticeClass: 'SIGNIFICANT',
        consentRequired: true,
        proposedEffectiveDate: addDays(today, 30),
      });
      expect(significant.check).toEqual({ ok: false, reason: 'members_exist' });
      expect(significant.decision.status).toBe(409);
      await cancel(significant.request).expect(200);
      const reconsent = await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
        consentRequired: true,
        proposedEffectiveDate: addDays(today, 7),
      });
      expect(reconsent.check).toEqual({ ok: false, reason: 'members_exist' });
      expect(reconsent.decision.status).toBe(409);
      await cancel(reconsent.request).expect(200);
      const general = await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
        proposedEffectiveDate: addDays(today, 7),
      });
      expect(general.decision.status).toBe(200);
    } finally {
      await sandbox.admin.query(`DELETE FROM ${sandbox.table('User')} WHERE "id" = $1`, [userId]);
    }
  });

  it('withdraws a scheduled version once, never after it takes effect, and never again', async () => {
    const scheduled = await publish('PRIVACY_POLICY', { proposedEffectiveDate: addDays(today, 7) });
    expect(scheduled.decision.status).toBe(200);
    const version = decided(scheduled.decision).version!;

    const initialRow = await sandbox.admin.query<{ id: string }>(
      `SELECT "id" FROM ${sandbox.table('LegalDocumentVersion')} WHERE "kind" = 'PRIVACY_POLICY' AND "noticeClass" = 'INITIAL'`,
    );
    const initialId = initialRow.rows[0]!.id;
    const notWithdrawable = await test.http
      .post(`/legal/versions/${initialId}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({});
    expect(notWithdrawable.status).toBe(409);
    // The same rule as the approval screen reads it, for a request row written directly.
    const initialRequestId = randomUUID();
    const initialDigest = await sandbox.admin.query<{ contentDigest: string }>(
      `SELECT "contentDigest" FROM ${sandbox.table('LegalDocumentVersion')} WHERE "id" = $1`,
      [initialId],
    );
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('AdminApprovalRequest')}
         ("id", "kind", "contentDigest", "targetLegalVersionId", "requestedByAccountId", "expiresAt")
       VALUES ($1, 'LEGAL_WITHDRAW', $2, $3, $4, now() + interval '7 days')`,
      [initialRequestId, initialDigest.rows[0]!.contentDigest, initialId, owner.accountId],
    );
    expect((await detailOf({ id: initialRequestId })).check).toEqual({
      ok: false,
      reason: 'not_withdrawable',
    });
    await cancel({ id: initialRequestId }).expect(200);

    const withdraw = await test.http
      .post(`/legal/versions/${version.id}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({ reason: 'wrong date' })
      .expect(200);
    const withdrawRequest = legalRequestSchema.parse(withdraw.body);
    expect(withdrawRequest).toMatchObject({
      kind: 'LEGAL_WITHDRAW',
      contentDigest: version.contentDigest,
    });
    expect((await detailOf(withdrawRequest)).check).toEqual({ ok: true });
    // A second request written before the first decision (a race the conditional UPDATE settles).
    const raceId = randomUUID();
    await sandbox.admin.query(
      `INSERT INTO ${sandbox.table('AdminApprovalRequest')}
         ("id", "kind", "contentDigest", "targetLegalVersionId", "requestedByAccountId", "expiresAt")
       VALUES ($1, 'LEGAL_WITHDRAW', $2, $3, $4, now() + interval '7 days')`,
      [raceId, version.contentDigest, version.id, owner.accountId],
    );

    const withdrawn = await approve(withdrawRequest);
    expect(withdrawn.status).toBe(200);
    expect(decided(withdrawn).version?.withdrawnAt).not.toBeNull();
    const first = (await versionsOf('PRIVACY_POLICY')).find((row) => row.withdrawnAt !== null);
    expect(first?.withdrawnAt).toBeInstanceOf(Date);

    expect((await detailOf({ id: raceId })).check).toEqual({
      ok: false,
      reason: 'already_withdrawn',
    });
    const again = await approve({ ...withdrawRequest, id: raceId });
    expect(again.status).toBe(409);
    const after = (await versionsOf('PRIVACY_POLICY')).find((row) => row.withdrawnAt !== null);
    expect(after?.withdrawnAt?.getTime()).toBe(first?.withdrawnAt?.getTime());

    // A version in effect is not withdrawn, even with a request written while it was scheduled.
    const next = await publish('PRIVACY_POLICY', { proposedEffectiveDate: addDays(today, 8) });
    expect(next.decision.status).toBe(200);
    const nextVersion = decided(next.decision).version!;
    const late = await test.http
      .post(`/legal/versions/${nextVersion.id}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({})
      .expect(200);
    await sandbox.admin.query(
      `UPDATE ${sandbox.table('LegalDocumentVersion')} SET "effectiveDate" = $2::date WHERE "id" = $1`,
      [nextVersion.id, today],
    );
    const lateRequest = legalRequestSchema.parse(late.body);
    expect((await detailOf(lateRequest)).check).toEqual({
      ok: false,
      reason: 'already_in_effect',
    });
    const inEffect = await approve(lateRequest);
    expect(inEffect.status).toBe(409);
    const { rows } = await sandbox.admin.query<{ withdrawnAt: Date | null }>(
      `SELECT "withdrawnAt" FROM ${sandbox.table('LegalDocumentVersion')} WHERE "id" = $1`,
      [nextVersion.id],
    );
    expect(rows[0]!.withdrawnAt).toBeNull();
  });

  it('states each version as of the database clock and follows the live version before a draft date', async () => {
    const { rows: versions } = await sandbox.admin.query<{
      id: string;
      noticeClass: string;
      effectiveDate: string;
      withdrawn: boolean;
    }>(
      `SELECT "id", "noticeClass", to_char("effectiveDate", 'YYYY-MM-DD') AS "effectiveDate",
              "withdrawnAt" IS NOT NULL AS "withdrawn"
       FROM ${sandbox.table('LegalDocumentVersion')} WHERE "kind" = 'PRIVACY_POLICY'`,
    );
    const version = versions.find((row) => row.withdrawn)!;
    const nextVersion = versions.find((row) => !row.withdrawn && row.effectiveDate === today)!;
    const initialId = versions.find((row) => row.noticeClass === 'INITIAL')!.id;

    // The overview states each version as of the database clock.
    const overview = legalDocumentsOverviewResponseSchema.parse(
      (await read('/legal/documents').expect(200)).body,
    );
    const states = new Map(
      overview.documents
        .find((document) => document.kind === 'PRIVACY_POLICY')!
        .versions.map((row) => [row.id, row.state]),
    );
    expect(states.get(version.id)).toBe('withdrawn');
    expect(states.get(nextVersion.id)).toBe('current');
    expect(states.get(initialId)).toBe('previous');
    const detail = legalBackofficeVersionDetailSchema.parse(
      (await read(`/legal/versions/${nextVersion.id}`).expect(200)).body,
    );
    expect(detail.sections).toEqual(SECTIONS);
    await read('/legal/versions/no-such-version').expect(404);
    await read('/legal/versions/Not_A_Version').expect(404);

    // A draft follows the live version just before its date, never the withdrawn one, in its
    // stored column and in the preview, and follows again when it is saved for another date.
    const following = await createDraft('PRIVACY_POLICY', {
      proposedEffectiveDate: addDays(today, 10),
    });
    expect(following.basedOnVersionId).toBe(nextVersion.id);
    const preview = legalDraftDetailResponseSchema.parse(
      (await read(`/legal/drafts/${following.id}`).expect(200)).body,
    );
    expect(preview.previousVersion?.id).toBe(nextVersion.id);
    expect(preview.comparison.length).toBeGreaterThan(0);
    const moved = legalDraftSchema.parse(
      (await saveDraft(following, 'PRIVACY_POLICY', { proposedEffectiveDate: today }).expect(200))
        .body,
    );
    expect(moved.basedOnVersionId).toBe(initialId);
    await discard(moved).expect(200);
  });

  it('rolls the version back when the audit row cannot be written', async () => {
    const draft = await createDraft('PRIVACY_POLICY', {
      proposedEffectiveDate: addDays(today, 20),
    });
    const request = await requestPublish(draft);
    const before = (await versionsOf('PRIVACY_POLICY')).length;
    await sandbox.admin.query(
      `REVOKE INSERT ON ${sandbox.table('AdminAuditEvent')} FROM backoffice_runtime`,
    );
    try {
      const failed = await approve(request);
      expect(failed.status).toBe(500);
    } finally {
      await sandbox.admin.query(
        `GRANT INSERT ("id", "actorType", "actorAccountId", "sessionId", "accessPath", "action", "targetType", "targetId", "approvalRequestId", "result", "selfApproved", "reason", "requestId", "metadata") ON ${sandbox.table('AdminAuditEvent')} TO backoffice_runtime`,
      );
    }
    expect((await versionsOf('PRIVACY_POLICY')).length).toBe(before);
    expect(await draftStatus(draft.id)).toBe('PENDING_APPROVAL');
    const { rows } = await sandbox.admin.query<{ status: string }>(
      `SELECT "status" FROM ${sandbox.table('AdminApprovalRequest')} WHERE "id" = $1`,
      [request.id],
    );
    expect(rows[0]!.status).toBe('PENDING');
  });

  it('decides two scheduled versions of one kind at the same time as one approval and one refusal', async () => {
    const drafts = await Promise.all(
      [10, 11].map((days) =>
        createDraft('PRIVACY_POLICY', { proposedEffectiveDate: addDays(today, days) }),
      ),
    );
    const requests = [];
    for (const draft of drafts) {
      requests.push(await requestPublish(draft));
    }
    for (const request of requests) {
      expect((await detailOf(request)).check).toEqual({ ok: true });
    }
    const decisions = await Promise.all(requests.map((request) => approve(request)));
    expect(decisions.map((decision) => decision.status).sort()).toEqual([200, 409]);
    const { rows } = await sandbox.admin.query<{ scheduled: number }>(
      `SELECT COUNT(*)::int AS "scheduled" FROM ${sandbox.table('LegalDocumentVersion')}
       WHERE "kind" = 'PRIVACY_POLICY' AND "withdrawnAt" IS NULL AND "effectiveDate" > $1::date`,
      [today],
    );
    expect(rows[0]!.scheduled).toBe(1);
    const refused = requests[decisions.findIndex((decision) => decision.status === 409)]!;
    expect((await detailOf(refused)).check).toEqual({
      ok: false,
      reason: 'scheduled_version_exists',
    });
    await cancel(refused).expect(200);
  });

  it('refuses saving a draft waiting for approval and a decision on another digest', async () => {
    const draft = await createDraft('AGE_14_OR_ABOVE_NOTICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -30),
    });
    const request = await requestPublish(draft);
    const saved = await test.http
      .put(`/legal/drafts/${draft.id}`)
      .set(bearer(owner.token))
      .send({
        revision: draft.revision,
        draft: draftBody('AGE_14_OR_ABOVE_NOTICE', {
          noticeClass: 'INITIAL',
          proposedEffectiveDate: addDays(today, -31),
        }),
      });
    // The error body carries only the code; the draft and the request show nothing happened.
    expect(saved.status).toBe(409);
    expect(await draftStatus(draft.id)).toBe('PENDING_APPROVAL');
    const otherDigest = await approve({ ...request, contentDigest: 'f'.repeat(64) });
    expect(otherDigest.status).toBe(409);
    expect((await detailOf(request)).request.status).toBe('PENDING');
    await cancel(request).expect(200);
  });

  it('pages drafts by creation time, keeps a draft saved between pages and discards a draft once', async () => {
    const kind = 'AGE_14_OR_ABOVE_NOTICE';
    const initialAt = (days: number) => ({
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, days),
    });
    const older = await createDraft(kind, initialAt(-50));
    const newer = await createDraft(kind, initialAt(-51));
    const query = `kind=${kind}&status=EDITING&limit=1`;
    const first = await listDrafts(query);
    expect(first.drafts.map((draft) => draft.id)).toEqual([newer.id]);

    // Saved after the first page was read: the page cursor does not move with the save.
    const saved = legalDraftSchema.parse(
      (await saveDraft(older, kind, initialAt(-52)).expect(200)).body,
    );
    const seen = first.drafts.map((draft) => draft.id);
    let next = first.nextPage;
    while (next) {
      const page = await listDrafts(
        `${query}&beforeTime=${encodeURIComponent(next.beforeTime)}&beforeId=${next.beforeId}`,
      );
      seen.push(...page.drafts.map((draft) => draft.id));
      next = page.nextPage;
    }
    expect(seen).toContain(older.id);
    expect(new Set(seen).size).toBe(seen.length);

    await discard({ ...saved, revision: saved.revision - 1 }).expect(409);
    const discarded = legalDraftSchema.parse((await discard(saved).expect(200)).body);
    expect(discarded.status).toBe('DISCARDED');
    // A discarded draft is closed like a published one.
    await saveDraft(discarded, kind, initialAt(-53)).expect(409);
    await discard(discarded).expect(409);
    await test.http
      .post(`/legal/drafts/${discarded.id}/publish-requests`)
      .set(bearer(owner.token))
      .send({ revision: discarded.revision })
      .expect(409);
    expect(await draftStatus(discarded.id)).toBe('DISCARDED');
    await discard(newer).expect(200);
  });

  it('returns the draft to editing when its request is rejected, cancelled or expired', async () => {
    const kind = 'AGE_14_OR_ABOVE_NOTICE';
    const author = await createDraft(kind, {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -30),
    });
    const save = (draft: { id: string; revision: number }, days: number) =>
      saveDraft(draft, kind, {
        noticeClass: 'INITIAL',
        proposedEffectiveDate: addDays(today, days),
      });
    const listed = async (status: string) =>
      (await listDrafts(`kind=${kind}&status=${status}&limit=100`)).drafts.map((draft) => draft.id);

    const rejected = await requestPublish(author);
    // The requester cancels rather than rejects; only another approver rejects (OA-R9).
    const selfReject = await test.http
      .post(`/legal/requests/${rejected.id}/reject`)
      .set(bearer(owner.token))
      .send({ contentDigest: rejected.contentDigest, reason: 'no' });
    expect(selfReject.status).toBe(403);
    await cancel(rejected).expect(200);
    expect(await draftStatus(author.id)).toBe('EDITING');
    const afterCancel = legalDraftSchema.parse((await save(author, -31).expect(200)).body);

    const expiring = await requestPublish(afterCancel);
    expect(await listed('PENDING_APPROVAL')).toContain(afterCancel.id);
    expect(await listed('EDITING')).not.toContain(afterCancel.id);
    test.clock.advance(7 * DAY_MS + 60_000);
    owner = await fresh(owner);
    expect(await draftStatus(afterCancel.id)).toBe('PENDING_APPROVAL');
    // Before anything is saved, the list filters by the status it shows: editing.
    expect(await listed('EDITING')).toContain(afterCancel.id);
    expect(await listed('PENDING_APPROVAL')).not.toContain(afterCancel.id);
    const afterExpiry = legalDraftSchema.parse((await save(afterCancel, -32).expect(200)).body);
    expect(afterExpiry.status).toBe('EDITING');
    const { rows } = await sandbox.admin.query<{ status: string }>(
      `SELECT "status" FROM ${sandbox.table('AdminApprovalRequest')} WHERE "id" = $1`,
      [expiring.id],
    );
    expect(rows[0]!.status).toBe('EXPIRED');

    // A decision on an expired request closes it and returns its draft, then refuses.
    const late = await requestPublish(afterExpiry);
    test.clock.advance(7 * DAY_MS + 60_000);
    owner = await fresh(owner);
    const refused = await approve(late);
    expect(refused.status).toBe(409);
    expect((await detailOf(late)).request.status).toBe('EXPIRED');
    expect(await draftStatus(afterExpiry.id)).toBe('EDITING');
  });

  it('shows a closed request with its draft as it is now and no decision check', async () => {
    const { rows } = await sandbox.admin.query<{ id: string }>(
      `SELECT "id" FROM ${sandbox.table('AdminApprovalRequest')}
       WHERE "kind" = 'LEGAL_PUBLISH' AND "status" = 'APPROVED' ORDER BY "createdAt" LIMIT 1`,
    );
    const approvedDetail = await detailOf({ id: rows[0]!.id });
    expect(approvedDetail.request.status).toBe('APPROVED');
    expect(approvedDetail.draft?.status).toBe('PUBLISHED');
    expect(approvedDetail.check).toBeNull();

    const kind = 'AGE_14_OR_ABOVE_NOTICE';
    const draft = await createDraft(kind, {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -60),
    });
    const cancelled = await requestPublish(draft);
    await cancel(cancelled).expect(200);
    const resaved = legalDraftSchema.parse(
      (
        await saveDraft(draft, kind, {
          noticeClass: 'INITIAL',
          proposedEffectiveDate: addDays(today, -61),
        }).expect(200)
      ).body,
    );
    const again = await requestPublish(resaved);
    // The cancelled request names a draft now waiting on another request.
    const cancelledDetail = await detailOf(cancelled);
    expect(cancelledDetail.request.status).toBe('CANCELLED');
    expect(cancelledDetail.draft?.status).toBe('PENDING_APPROVAL');
    expect(cancelledDetail.check).toBeNull();
    await cancel(again).expect(200);
    await discard(
      legalDraftSchema.parse((await read(`/legal/drafts/${draft.id}`).expect(200)).body.draft),
    ).expect(200);
  });

  it('keeps legal requests off the role request path', async () => {
    const draft = await createDraft('AGE_14_OR_ABOVE_NOTICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -30),
    });
    const request = await requestPublish(draft);

    const list = await test.http.get('/access/requests').set(bearer(owner.token)).expect(200);
    const parsed = accessRequestListResponseSchema.parse(list.body);
    expect(parsed.requests.map((row) => row.id)).not.toContain(request.id);
    for (const action of ['approve', 'reject', 'cancel'] as const) {
      const refused = await test.http
        .post(`/access/requests/${request.id}/${action}`)
        .set(bearer(owner.token))
        .send({ contentDigest: request.contentDigest, reason: 'role path' });
      expect(refused.status, action).toBe(404);
    }
    const legal = legalRequestListResponseSchema.parse(
      (await read('/legal/requests').expect(200)).body,
    );
    expect(legal.requests.map((row) => row.id)).toContain(request.id);
    await cancel(request).expect(200);
  });

  it('refuses self approval once a second legal approver is active', async () => {
    const operator = await inviteOperator(test, owner, 'legal-approver@backoffice.test');
    const grant = await test.http
      .post('/access/requests')
      .set(bearer(owner.token))
      .send({
        kind: 'ROLE_GRANT',
        targetAccountId: operator.accountId,
        targetRole: 'LEGAL_APPROVER',
      })
      .expect(200);
    await test.http
      .post(`/access/requests/${grant.body.id as string}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: grant.body.contentDigest as string, reason: 'legal approver setup' })
      .expect(200);
    const approver = await fresh(operator);

    // Another approver's rejection returns the draft to editing as well.
    const toReject = await createDraft('AGE_14_OR_ABOVE_NOTICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -40),
    });
    const rejectRequest = await requestPublish(toReject);
    await test.http
      .post(`/legal/requests/${rejectRequest.id}/reject`)
      .set(bearer(approver.token))
      .send({ contentDigest: rejectRequest.contentDigest, reason: 'wrong date' })
      .expect(200);
    expect(await draftStatus(toReject.id)).toBe('EDITING');
    // The rejected draft is saved again like a cancelled one.
    const resaved = legalDraftSchema.parse(
      (
        await saveDraft(toReject, 'AGE_14_OR_ABOVE_NOTICE', {
          noticeClass: 'INITIAL',
          proposedEffectiveDate: addDays(today, -41),
        }).expect(200)
      ).body,
    );
    expect(resaved).toMatchObject({ status: 'EDITING', revision: toReject.revision + 1 });

    const draft = await createDraft('AGE_14_OR_ABOVE_NOTICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -30),
    });
    const request = await requestPublish(draft);
    const self = await approve(request, owner, 'still alone?');
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('permission_denied');

    const approved = await approve(request, approver, undefined);
    expect(approved.status).toBe(200);
    expect(decided(approved).request).toMatchObject({
      status: 'APPROVED',
      selfApproved: false,
      decidedByAccountId: approver.accountId,
    });
    const { rows } = await sandbox.admin.query<{ action: string; targetType: string }>(
      `SELECT "action", "targetType" FROM ${sandbox.table('AdminAuditEvent')}
       WHERE "approvalRequestId" = $1 ORDER BY "occurredAt", "id"`,
      [request.id],
    );
    expect(rows).toEqual([
      { action: 'LEGAL_PUBLISH_REQUEST', targetType: 'LEGAL_DOCUMENT_DRAFT' },
      { action: 'LEGAL_PUBLISH_APPROVE', targetType: 'LEGAL_DOCUMENT_VERSION' },
    ]);

    legalApprover = approver;
  });

  it('refuses deactivating the second legal approver until that role is revoked through a request', async () => {
    expect(legalApprover).not.toBeNull();
    const approver = legalApprover!;
    // Deactivating the second legal approver would leave the owner the only legal approver again,
    // so it is refused; the legal approver role is revoked through a request first (OA-R9).
    const refused = await test.http
      .post(`/accounts/${approver.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('conflict');
    const { rows: untouched } = await sandbox.admin.query<{ status: string; roles: number }>(
      `SELECT a."status", (SELECT COUNT(*)::int FROM ${sandbox.table('AdminRoleAssignment')} r
         WHERE r."accountId" = a."id" AND r."revokedAt" IS NULL AND r."role" = 'LEGAL_APPROVER') AS roles
       FROM ${sandbox.table('AdminAccount')} a WHERE a."id" = $1`,
      [approver.accountId],
    );
    expect(untouched).toEqual([{ status: 'ACTIVE', roles: 1 }]);
    const revoke = await test.http
      .post('/access/requests')
      .set(bearer(owner.token))
      .send({
        kind: 'ROLE_REVOKE',
        targetAccountId: approver.accountId,
        targetRole: 'LEGAL_APPROVER',
      })
      .expect(200);
    await test.http
      .post(`/access/requests/${revoke.body.id as string}/approve`)
      .set(bearer(owner.token))
      .send({ contentDigest: revoke.body.contentDigest as string, reason: 'leaving' })
      .expect(200);
    await test.http
      .post(`/accounts/${approver.accountId}/deactivate`)
      .set(bearer(owner.token))
      .send({ reason: 'left the team' })
      .expect(204);
  });
});
