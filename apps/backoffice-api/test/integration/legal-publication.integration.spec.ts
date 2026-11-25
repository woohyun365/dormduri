import { randomUUID } from 'node:crypto';
import { accessRequestListResponseSchema } from '@repo/shared/backoffice';
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

interface DraftView {
  id: string;
  kind: Kind;
  status: string;
  revision: number;
  contentDigest: string;
}

interface RequestView {
  id: string;
  kind: string;
  status: string;
  contentDigest: string;
  selfApproved: boolean;
  decidedByAccountId: string | null;
}

interface VersionView {
  id: string;
  kind: Kind;
  noticeClass: string;
  effectiveDate: string;
  appliesUntil: string | null;
  contentDigest: string;
  publishedAt: string;
  withdrawnAt: string | null;
  requestedByAccountId: string | null;
  approvedByAccountId: string | null;
  selfApproved: boolean;
}

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
 * Backoffice legal publication against real PostgreSQL as `dormduri_backoffice` (plan Phase L2b RED,
 * D-LC3·D-LC8·D-LC9). The scenarios share one sandbox and run in order: each kind's versions build
 * on the steps before. Notice dates count from the database's KST date, which also decides approval.
 */
describe('backoffice legal publication (D-LC3, OA-R9)', () => {
  let sandbox: IntegrationSandbox;
  let test: BackofficeTestApp;
  let owner: RegisteredOperator;
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

  const createDraft = async (
    kind: Kind,
    overrides: Record<string, unknown> = {},
    author = owner,
  ): Promise<DraftView> => {
    const response = await test.http
      .post('/legal/drafts')
      .set(bearer(author.token))
      .send({ source: 'editor', draft: draftBody(kind, overrides) })
      .expect(200);
    return response.body as DraftView;
  };

  const requestPublish = async (draft: DraftView, requester = owner): Promise<RequestView> => {
    const response = await test.http
      .post(`/legal/drafts/${draft.id}/publish-requests`)
      .set(bearer(requester.token))
      .send({ revision: draft.revision })
      .expect(200);
    return response.body as RequestView;
  };

  const approve = (
    request: RequestView,
    approver = owner,
    reason: string | undefined = 'sole approver',
  ) =>
    test.http
      .post(`/legal/requests/${request.id}/approve`)
      .set(bearer(approver.token))
      .send({ contentDigest: request.contentDigest, ...(reason === undefined ? {} : { reason }) });

  const cancel = (request: RequestView, requester = owner) =>
    test.http.post(`/legal/requests/${request.id}/cancel`).set(bearer(requester.token)).send({});

  /** Draft, request and approval in one step; returns the decision response. */
  const publish = async (kind: Kind, overrides: Record<string, unknown> = {}) => {
    const draft = await createDraft(kind, overrides);
    const request = await requestPublish(draft);
    return { draft, request, decision: await approve(request) };
  };

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

  it('leaves a legal request row out of the role request list and decisions (RED ⑫)', async () => {
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

  it('refuses the legal routes to an account without a legal permission (RED ⑧)', async () => {
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
    // The owner role holds both legal permissions (D-LC3).
    await test.http.get('/legal/documents').set(bearer(owner.token)).expect(200);
  });

  it('takes a historical record only with an end before the approval date, then the first publication right after it (RED ⑪ ⑨)', async () => {
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
    expect(notBefore.decision.status).toBe(409);
    expect(notBefore.decision.body.error.code).toBe('conflict');
    await cancel(notBefore.request).expect(200);

    const saved = await test.http
      .put(`/legal/drafts/${notBefore.draft.id}`)
      .set(bearer(owner.token))
      .send({
        revision: notBefore.draft.revision,
        draft: draftBody('PRIVACY_POLICY', {
          noticeClass: 'HISTORICAL',
          proposedEffectiveDate: addDays(today, -200),
          appliesUntil: addDays(today, -10),
        }),
      })
      .expect(200);
    const historical = await approve(await requestPublish(saved.body as DraftView));
    expect(historical.status).toBe(200);
    expect(historical.body.version as VersionView).toMatchObject({
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
    const changed = await approve(secondRequest);
    expect(changed.status).toBe(409);
    await cancel(secondRequest).expect(200);

    const notNextDay = await publish('PRIVACY_POLICY', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -8),
    });
    expect(notNextDay.decision.status).toBe(409);
    await cancel(notNextDay.request).expect(200);

    const initial = await publish('PRIVACY_POLICY', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -9),
    });
    expect(initial.decision.status).toBe(200);
    expect(await draftStatus(initial.draft.id)).toBe('PUBLISHED');

    for (const noticeClass of ['HISTORICAL', 'INITIAL'] as const) {
      const again = await publish('PRIVACY_POLICY', {
        noticeClass,
        proposedEffectiveDate: addDays(today, -500),
        ...(noticeClass === 'HISTORICAL' ? { appliesUntil: addDays(today, -450) } : {}),
      });
      expect(again.decision.status, noticeClass).toBe(409);
      await cancel(again.request).expect(200);
    }
    expect((await versionsOf('PRIVACY_POLICY')).map((row) => row.noticeClass)).toEqual([
      'HISTORICAL',
      'INITIAL',
    ]);
  });

  it('needs seven days of notice for a general version and thirty for a significant one (RED ③ ④)', async () => {
    const early = await publish('TERMS_OF_SERVICE', { proposedEffectiveDate: addDays(today, 7) });
    // No first publication yet: a revision has nothing to follow.
    expect(early.decision.status).toBe(409);
    await cancel(early.request).expect(200);
    const afterToday = await publish('TERMS_OF_SERVICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, 1),
    });
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
    expect(sixDays.decision.status).toBe(409);
    await cancel(sixDays.request).expect(200);
    const significant = { noticeClass: 'SIGNIFICANT', consentRequired: true };
    const twentyNine = await publish('TERMS_OF_SERVICE', {
      ...significant,
      proposedEffectiveDate: addDays(today, 29),
    });
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
    expect(secondInitial.decision.status).toBe(409);
    await cancel(secondInitial.request).expect(200);
    const secondScheduled = await publish('TERMS_OF_SERVICE', {
      proposedEffectiveDate: addDays(today, 40),
    });
    expect(secondScheduled.decision.status).toBe(409);
    await cancel(secondScheduled.request).expect(200);
    expect(await test.metrics.render()).toMatch(
      /backoffice_legal_decisions_total\{(?=[^}]*decision="publish_approved")(?=[^}]*kind="TERMS_OF_SERVICE")(?=[^}]*notice_class="SIGNIFICANT")[^}]*\} 1/u,
    );
  });

  it('refuses significant and reconsent versions while a member can receive mail (RED ② ⑭)', async () => {
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
      const significant = await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
        noticeClass: 'SIGNIFICANT',
        consentRequired: true,
        proposedEffectiveDate: addDays(today, 30),
      });
      expect(significant.decision.status).toBe(409);
      await cancel(significant.request).expect(200);
      const reconsent = await publish('PERSONAL_DATA_COLLECTION_USE_CONSENT', {
        consentRequired: true,
        proposedEffectiveDate: addDays(today, 7),
      });
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

  it('withdraws a scheduled version once, never after it takes effect, and never again (RED ⑥ ⑩ ⑮)', async () => {
    const scheduled = await publish('PRIVACY_POLICY', { proposedEffectiveDate: addDays(today, 7) });
    expect(scheduled.decision.status).toBe(200);
    const version = scheduled.decision.body.version as VersionView;

    const initialRow = await sandbox.admin.query<{ id: string }>(
      `SELECT "id" FROM ${sandbox.table('LegalDocumentVersion')} WHERE "kind" = 'PRIVACY_POLICY' AND "noticeClass" = 'INITIAL'`,
    );
    const notWithdrawable = await test.http
      .post(`/legal/versions/${initialRow.rows[0]!.id}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({});
    expect(notWithdrawable.status).toBe(409);

    const withdraw = await test.http
      .post(`/legal/versions/${version.id}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({ reason: 'wrong date' })
      .expect(200);
    const withdrawRequest = withdraw.body as RequestView;
    expect(withdrawRequest).toMatchObject({
      kind: 'LEGAL_WITHDRAW',
      contentDigest: version.contentDigest,
    });
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
    const first = (await versionsOf('PRIVACY_POLICY')).find((row) => row.withdrawnAt !== null);
    expect(first?.withdrawnAt).toBeInstanceOf(Date);

    const again = await approve({ ...withdrawRequest, id: raceId });
    expect(again.status).toBe(409);
    const after = (await versionsOf('PRIVACY_POLICY')).find((row) => row.withdrawnAt !== null);
    expect(after?.withdrawnAt?.getTime()).toBe(first?.withdrawnAt?.getTime());

    // A version in effect is not withdrawn, even with a request written while it was scheduled.
    const next = await publish('PRIVACY_POLICY', { proposedEffectiveDate: addDays(today, 8) });
    expect(next.decision.status).toBe(200);
    const nextVersion = next.decision.body.version as VersionView;
    const late = await test.http
      .post(`/legal/versions/${nextVersion.id}/withdraw-requests`)
      .set(bearer(owner.token))
      .send({})
      .expect(200);
    await sandbox.admin.query(
      `UPDATE ${sandbox.table('LegalDocumentVersion')} SET "effectiveDate" = $2::date WHERE "id" = $1`,
      [nextVersion.id, today],
    );
    const inEffect = await approve(late.body as RequestView);
    expect(inEffect.status).toBe(409);
    const { rows } = await sandbox.admin.query<{ withdrawnAt: Date | null }>(
      `SELECT "withdrawnAt" FROM ${sandbox.table('LegalDocumentVersion')} WHERE "id" = $1`,
      [nextVersion.id],
    );
    expect(rows[0]!.withdrawnAt).toBeNull();
  });

  it('rolls the version back when the audit row cannot be written (RED ⑦)', async () => {
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

  it('refuses saving a draft waiting for approval and a decision on another digest (RED ⑤)', async () => {
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
    expect(saved.status).toBe(409);
    const otherDigest = await approve({ ...request, contentDigest: 'f'.repeat(64) });
    expect(otherDigest.status).toBe(409);
    await cancel(request).expect(200);
  });

  it('returns the draft to editing when its request is rejected, cancelled or expired (RED ⑬)', async () => {
    const author = await createDraft('AGE_14_OR_ABOVE_NOTICE', {
      noticeClass: 'INITIAL',
      proposedEffectiveDate: addDays(today, -30),
    });
    const save = (draft: { id: string; revision: number }, days: number) =>
      test.http
        .put(`/legal/drafts/${draft.id}`)
        .set(bearer(owner.token))
        .send({
          revision: draft.revision,
          draft: draftBody('AGE_14_OR_ABOVE_NOTICE', {
            noticeClass: 'INITIAL',
            proposedEffectiveDate: addDays(today, days),
          }),
        });

    const rejected = await requestPublish(author);
    // The requester cancels rather than rejects; only another approver rejects (OA-R9).
    const selfReject = await test.http
      .post(`/legal/requests/${rejected.id}/reject`)
      .set(bearer(owner.token))
      .send({ contentDigest: rejected.contentDigest, reason: 'no' });
    expect(selfReject.status).toBe(403);
    await cancel(rejected).expect(200);
    expect(await draftStatus(author.id)).toBe('EDITING');
    const afterCancel = (await save(author, -31).expect(200)).body as DraftView;

    const expiring = await requestPublish(afterCancel);
    test.clock.advance(7 * DAY_MS + 60_000);
    owner = await fresh(owner);
    expect(await draftStatus(afterCancel.id)).toBe('PENDING_APPROVAL');
    const afterExpiry = (await save(afterCancel, -32).expect(200)).body as DraftView;
    expect(afterExpiry.status).toBe('EDITING');
    const { rows } = await sandbox.admin.query<{ status: string }>(
      `SELECT "status" FROM ${sandbox.table('AdminApprovalRequest')} WHERE "id" = $1`,
      [expiring.id],
    );
    expect(rows[0]!.status).toBe('EXPIRED');
  });

  it('keeps legal requests off the role request path (RED ⑫)', async () => {
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
    const legal = await test.http.get('/legal/requests').set(bearer(owner.token)).expect(200);
    expect((legal.body.requests as RequestView[]).map((row) => row.id)).toContain(request.id);
    await cancel(request).expect(200);
  });

  it('refuses self approval once a second legal approver is active (RED ①)', async () => {
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

    // Another approver's rejection returns the draft to editing as well (RED ⑬).
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
    expect(approved.body.request as RequestView).toMatchObject({
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
  });
});
