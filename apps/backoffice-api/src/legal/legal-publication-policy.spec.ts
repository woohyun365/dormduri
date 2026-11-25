import { describe, expect, it } from 'vitest';
import * as policy from './legal-publication-policy.js';
import type {
  LegalPublicationCandidate,
  LegalPublishedVersionFact,
} from './legal-publication-policy.js';

// 2026-12-01 10:00 KST: the approval date is 2026-12-01.
const NOW = new Date('2026-12-01T01:00:00.000Z');

const version = (
  overrides: Partial<LegalPublishedVersionFact> & Pick<LegalPublishedVersionFact, 'noticeClass'>,
): LegalPublishedVersionFact => ({
  id: `v-${overrides.noticeClass}-${overrides.effectiveDate ?? '2026-06-22'}`,
  effectiveDate: '2026-06-22',
  appliesUntil: null,
  withdrawnAt: null,
  ...overrides,
});
const candidate = (
  overrides: Partial<LegalPublicationCandidate> & Pick<LegalPublicationCandidate, 'noticeClass'>,
): LegalPublicationCandidate => ({
  kind: 'TERMS_OF_SERVICE',
  consentRequired: false,
  effectiveDate: '2026-12-08',
  appliesUntil: null,
  ...overrides,
});
const initial = version({ noticeClass: 'INITIAL', effectiveDate: '2026-06-22' });
const check = (
  next: LegalPublicationCandidate,
  versions: readonly LegalPublishedVersionFact[] = [initial],
  recipientCount = 0,
) => policy.checkLegalPublication({ candidate: next, versions, now: NOW, recipientCount });

describe('legal publication checks at decision time', () => {
  it('needs seven days of notice for a general version and thirty for a significant one', () => {
    expect(check(candidate({ noticeClass: 'GENERAL', effectiveDate: '2026-12-07' }))).toEqual({
      ok: false,
      reason: 'notice_too_short',
    });
    expect(check(candidate({ noticeClass: 'GENERAL', effectiveDate: '2026-12-08' }))).toEqual({
      ok: true,
    });
    expect(
      check(
        candidate({
          noticeClass: 'SIGNIFICANT',
          consentRequired: true,
          effectiveDate: '2026-12-30',
        }),
      ),
    ).toEqual({ ok: false, reason: 'notice_too_short' });
    expect(
      check(
        candidate({
          noticeClass: 'SIGNIFICANT',
          consentRequired: true,
          effectiveDate: '2026-12-31',
        }),
      ),
    ).toEqual({ ok: true });
  });

  it('counts the notice from the KST approval date, not the UTC one', () => {
    // 2026-12-01 23:30 KST is still 2026-12-01 in KST but 14:30Z of the same UTC day; 00:30 KST on the 2nd is 15:30Z.
    const lateKst = new Date('2026-12-01T15:30:00.000Z');
    expect(
      policy.checkLegalPublication({
        candidate: candidate({ noticeClass: 'GENERAL', effectiveDate: '2026-12-08' }),
        versions: [initial],
        now: lateKst,
        recipientCount: 0,
      }),
    ).toEqual({ ok: false, reason: 'notice_too_short' });
  });

  it('refuses a significant version and a reconsent version while any member can receive mail', () => {
    expect(
      check(
        candidate({
          noticeClass: 'SIGNIFICANT',
          consentRequired: true,
          effectiveDate: '2026-12-31',
        }),
        [initial],
        1,
      ),
    ).toEqual({ ok: false, reason: 'members_exist' });
    expect(
      check(candidate({ noticeClass: 'GENERAL', consentRequired: true }), [initial], 1),
    ).toEqual({ ok: false, reason: 'members_exist' });
    expect(check(candidate({ noticeClass: 'GENERAL' }), [initial], 1)).toEqual({ ok: true });
  });

  it('refuses a first publication or historical record once the kind has a publication', () => {
    const general = version({ noticeClass: 'GENERAL', effectiveDate: '2026-11-01' });
    expect(
      check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-11-20' }), [general]),
    ).toEqual({ ok: false, reason: 'first_publication_exists' });
    expect(check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-11-20' }))).toEqual({
      ok: false,
      reason: 'first_publication_exists',
    });
    expect(
      check(
        candidate({
          noticeClass: 'HISTORICAL',
          effectiveDate: '2026-01-01',
          appliesUntil: '2026-06-21',
        }),
      ),
    ).toEqual({ ok: false, reason: 'first_publication_exists' });
  });

  it('places the first publication on or before the approval date and right after the last historical record', () => {
    const record = version({
      noticeClass: 'HISTORICAL',
      effectiveDate: '2026-06-22',
      appliesUntil: '2026-11-19',
    });
    expect(
      check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-11-20' }), [record]),
    ).toEqual({
      ok: true,
    });
    expect(
      check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-11-21' }), [record]),
    ).toEqual({
      ok: false,
      reason: 'initial_not_after_history',
    });
    expect(check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-12-02' }), [])).toEqual({
      ok: false,
      reason: 'initial_after_approval',
    });
    expect(check(candidate({ noticeClass: 'INITIAL', effectiveDate: '2026-12-01' }), [])).toEqual({
      ok: true,
    });
  });

  it('takes a historical record only with an end before the approval date and no overlap', () => {
    const historical = (effectiveDate: string, appliesUntil: string | null) =>
      candidate({ noticeClass: 'HISTORICAL', effectiveDate, appliesUntil });
    expect(check(historical('2026-06-22', '2026-12-01'), [])).toEqual({
      ok: false,
      reason: 'historical_not_before_approval',
    });
    expect(check(historical('2026-06-22', null), [])).toEqual({
      ok: false,
      reason: 'historical_not_before_approval',
    });
    expect(check(historical('2026-06-22', '2026-11-30'), [])).toEqual({ ok: true });
    const earlier = version({
      noticeClass: 'HISTORICAL',
      effectiveDate: '2026-01-01',
      appliesUntil: '2026-06-22',
    });
    expect(check(historical('2026-06-22', '2026-11-19'), [earlier])).toEqual({
      ok: false,
      reason: 'historical_overlap',
    });
    expect(check(historical('2026-06-23', '2026-11-19'), [earlier])).toEqual({ ok: true });
  });

  it('keeps one scheduled version per kind and needs a first publication before a revision', () => {
    const scheduled = version({ noticeClass: 'GENERAL', effectiveDate: '2026-12-05' });
    expect(
      check(candidate({ noticeClass: 'GENERAL', effectiveDate: '2026-12-20' }), [
        initial,
        scheduled,
      ]),
    ).toEqual({
      ok: false,
      reason: 'scheduled_version_exists',
    });
    const withdrawn = { ...scheduled, withdrawnAt: new Date('2026-11-30T00:00:00.000Z') };
    expect(
      check(candidate({ noticeClass: 'GENERAL', effectiveDate: '2026-12-20' }), [
        initial,
        withdrawn,
      ]),
    ).toEqual({
      ok: true,
    });
    expect(check(candidate({ noticeClass: 'GENERAL' }), [])).toEqual({
      ok: false,
      reason: 'first_publication_required',
    });
  });
});

describe('legal withdrawal checks', () => {
  const scheduled = version({ noticeClass: 'GENERAL', effectiveDate: '2026-12-08' });

  it('withdraws a scheduled general or significant version until it takes effect', () => {
    expect(policy.checkLegalWithdrawal({ version: scheduled, now: NOW })).toEqual({ ok: true });
    // 2026-12-08 00:00 KST is 2026-12-07T15:00Z.
    expect(
      policy.checkLegalWithdrawal({
        version: scheduled,
        now: new Date('2026-12-07T14:59:59.999Z'),
      }),
    ).toEqual({ ok: true });
    expect(
      policy.checkLegalWithdrawal({
        version: scheduled,
        now: new Date('2026-12-07T15:00:00.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'already_in_effect' });
  });

  it('never withdraws twice, a first publication or a historical record', () => {
    expect(
      policy.checkLegalWithdrawal({
        version: { ...scheduled, withdrawnAt: new Date('2026-11-30T00:00:00.000Z') },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'already_withdrawn' });
    expect(policy.checkLegalWithdrawal({ version: initial, now: NOW })).toEqual({
      ok: false,
      reason: 'not_withdrawable',
    });
  });
});
