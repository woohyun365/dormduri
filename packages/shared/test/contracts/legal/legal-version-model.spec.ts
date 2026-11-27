import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import * as legal from '@repo/shared/legal';

// The version model helpers are read through the package surface so a missing export fails as an assertion.
const surface = legal as unknown as Record<string, unknown>;

function requireFunction<T>(name: string): T {
  expect(typeof surface[name], `@repo/shared/legal ${name}`).toBe('function');
  return surface[name] as T;
}

function requireSchema(name: string): ZodType {
  expect(typeof (surface[name] as { safeParse?: unknown } | undefined)?.safeParse, name).toBe(
    'function',
  );
  return surface[name] as ZodType;
}

type NoticeClass = 'HISTORICAL' | 'INITIAL' | 'GENERAL' | 'SIGNIFICANT';

interface TimelineInput {
  readonly name: string;
  readonly effectiveDate: string;
  readonly noticeClass: NoticeClass;
  readonly appliesUntil: string | null;
  readonly publishedAt: Date;
  readonly withdrawnAt: Date | null;
}

interface TimelineEntry extends TimelineInput {
  readonly status: 'scheduled' | 'current' | 'previous';
  readonly appliesFrom: string;
  readonly lastModifiedDate: string;
}

type BuildTimeline = (rows: readonly TimelineInput[], now: Date) => TimelineEntry[];
type EffectiveInstant = (versionKey: string) => Date;
type KstDate = (instant: Date) => string;

function version(
  name: string,
  effectiveDate: string,
  noticeClass: NoticeClass,
  options: { appliesUntil?: string; publishedAt?: string; withdrawnAt?: string } = {},
): TimelineInput {
  return {
    name,
    effectiveDate,
    noticeClass,
    appliesUntil: options.appliesUntil ?? null,
    publishedAt: new Date(options.publishedAt ?? '2026-06-01T00:00:00.000Z'),
    withdrawnAt: options.withdrawnAt ? new Date(options.withdrawnAt) : null,
  };
}

function summarize(entries: readonly TimelineEntry[]) {
  return entries.map(({ name, status, appliesFrom, appliesUntil }) => ({
    name,
    status,
    appliesFrom,
    appliesUntil,
  }));
}

const heading = (text: string) => ({ type: 'heading' as const, level: 2 as const, text });
const paragraph = (text: string) => ({ type: 'paragraph' as const, text });

describe('legal version model', () => {
  it('판 key는 실재하는 YYYY-MM-DD 날짜만 받는다', () => {
    const schema = requireSchema('legalVersionKeySchema');

    expect(schema.safeParse('2026-11-20').success).toBe(true);
    expect(schema.safeParse('2028-02-29').success).toBe(true);
    for (const value of [
      '2026-13-40',
      '2026-02-30',
      '2027-02-29',
      '20261120',
      '2026-11-20T00:00:00.000Z',
      ' 2026-11-20',
      '',
    ]) {
      expect(schema.safeParse(value).success, value).toBe(false);
    }
  });

  it('시행 시각은 시행일 00:00 KST이고 KST 날짜는 그 시각에 바뀐다', () => {
    const effectiveInstant = requireFunction<EffectiveInstant>('legalEffectiveInstant');
    const kstDate = requireFunction<KstDate>('toLegalKstDate');

    expect(effectiveInstant('2026-11-20').toISOString()).toBe('2026-11-19T15:00:00.000Z');
    expect(kstDate(new Date('2026-11-19T14:59:59.999Z'))).toBe('2026-11-19');
    expect(kstDate(new Date('2026-11-19T15:00:00.000Z'))).toBe('2026-11-20');
  });

  it('시행 예정 판은 시행 시각 1초 전에는 고르지 않고 시행 시각에는 고른다', () => {
    const buildTimeline = requireFunction<BuildTimeline>('buildLegalVersionTimeline');
    const effectiveInstant = requireFunction<EffectiveInstant>('legalEffectiveInstant');
    const rows = [
      version('first', '2026-06-22', 'INITIAL'),
      version('revision', '2026-12-01', 'GENERAL', { publishedAt: '2026-11-23T03:00:00.000Z' }),
    ];
    const effectiveAt = effectiveInstant('2026-12-01');

    expect(summarize(buildTimeline(rows, new Date(effectiveAt.getTime() - 1_000)))).toEqual([
      { name: 'revision', status: 'scheduled', appliesFrom: '2026-12-01', appliesUntil: null },
      { name: 'first', status: 'current', appliesFrom: '2026-06-22', appliesUntil: '2026-11-30' },
    ]);
    expect(summarize(buildTimeline(rows, effectiveAt))).toEqual([
      { name: 'revision', status: 'current', appliesFrom: '2026-12-01', appliesUntil: null },
      { name: 'first', status: 'previous', appliesFrom: '2026-06-22', appliesUntil: '2026-11-30' },
    ]);
  });

  it('이전 판 기록은 늘 이전 판이고 지정한 적용 끝을 쓴다', () => {
    const buildTimeline = requireFunction<BuildTimeline>('buildLegalVersionTimeline');
    const rows = [
      version('historical', '2026-06-22', 'HISTORICAL', { appliesUntil: '2026-11-19' }),
      version('first', '2026-11-20', 'INITIAL', { publishedAt: '2026-11-26T01:00:00.000Z' }),
    ];

    expect(summarize(buildTimeline(rows, new Date('2026-11-26T02:00:00.000Z')))).toEqual([
      { name: 'first', status: 'current', appliesFrom: '2026-11-20', appliesUntil: null },
      {
        name: 'historical',
        status: 'previous',
        appliesFrom: '2026-06-22',
        appliesUntil: '2026-11-19',
      },
    ]);
  });

  it('철회한 판과 공지 시작 전 판은 시간표에 없고 앞 판의 적용 끝도 바꾸지 않는다', () => {
    const buildTimeline = requireFunction<BuildTimeline>('buildLegalVersionTimeline');
    const rows = [
      version('first', '2026-06-22', 'INITIAL'),
      version('withdrawn', '2026-12-01', 'GENERAL', {
        publishedAt: '2026-11-20T00:00:00.000Z',
        withdrawnAt: '2026-11-22T00:00:00.000Z',
      }),
      version('not-yet-published', '2026-12-31', 'GENERAL', {
        publishedAt: '2026-11-30T00:00:00.000Z',
      }),
    ];

    expect(summarize(buildTimeline(rows, new Date('2026-11-25T00:00:00.000Z')))).toEqual([
      { name: 'first', status: 'current', appliesFrom: '2026-06-22', appliesUntil: null },
    ]);
  });

  it('최종 수정일은 첫 게시·이전 판 기록은 시행일, 일반·중대 판은 승인일의 KST 날짜다', () => {
    const buildTimeline = requireFunction<BuildTimeline>('buildLegalVersionTimeline');
    const rows = [
      version('historical', '2026-06-22', 'HISTORICAL', {
        appliesUntil: '2026-11-19',
        publishedAt: '2026-11-26T01:00:00.000Z',
      }),
      version('first', '2026-11-20', 'INITIAL', { publishedAt: '2026-11-26T01:00:00.000Z' }),
      // 2026-11-26T16:30Z is 2026-11-27 01:30 KST.
      version('revision', '2027-01-04', 'GENERAL', { publishedAt: '2026-11-26T16:30:00.000Z' }),
    ];
    const byName = new Map(
      buildTimeline(rows, new Date('2026-11-27T00:00:00.000Z')).map((entry) => [
        entry.name,
        entry.lastModifiedDate,
      ]),
    );

    expect(Object.fromEntries(byName)).toEqual({
      historical: '2026-06-22',
      first: '2026-11-20',
      revision: '2026-11-27',
    });
  });

  it('조항 대조는 제N조 접두로 짝짓고 추가·삭제·변경·그대로를 앞뒤 section과 낸다', () => {
    const compare =
      requireFunction<
        (before: unknown[] | null, after: unknown[]) => Array<Record<string, unknown>>
      >('compareLegalSections');
    const before = [
      paragraph('머리말'),
      heading('제1조(목적)'),
      paragraph('목적 문장'),
      heading('제2조(수집 항목)'),
      paragraph('이메일'),
      heading('제3조(제3자 제공)'),
      paragraph('제공하지 않습니다.'),
      heading('제4조(파기)'),
      paragraph('지체 없이 파기합니다.'),
      heading('부칙'),
      paragraph('2026년 6월 22일부터 시행합니다.'),
    ];
    const after = [
      paragraph('머리말'),
      heading('제1조(목적)'),
      paragraph('목적 문장'),
      heading('제2조(수집 항목)'),
      paragraph('이메일, 닉네임'),
      heading('제3조(제3자 제공 및 공개)'),
      paragraph('제공하지 않습니다.'),
      heading('제5조(안전성 확보조치)'),
      paragraph('접근 권한을 관리합니다.'),
      heading('부칙'),
      paragraph('2026년 12월 1일부터 시행합니다.'),
    ];

    expect(compare(before, after).map((article) => [article.heading, article.change])).toEqual([
      [null, 'unchanged'],
      ['제1조(목적)', 'unchanged'],
      ['제2조(수집 항목)', 'changed'],
      ['제3조(제3자 제공 및 공개)', 'changed'],
      ['제4조(파기)', 'removed'],
      ['제5조(안전성 확보조치)', 'added'],
      ['부칙', 'changed'],
    ]);
    const renamed = compare(before, after).find((article) =>
      String(article.heading).startsWith('제3조'),
    );
    expect(renamed?.before).toEqual([
      heading('제3조(제3자 제공)'),
      paragraph('제공하지 않습니다.'),
    ]);
    expect(renamed?.after).toEqual([
      heading('제3조(제3자 제공 및 공개)'),
      paragraph('제공하지 않습니다.'),
    ]);
    const removed = compare(before, after).find((article) => article.change === 'removed');
    expect(removed?.after).toEqual([]);
    expect(compare(null, after)).toEqual([]);
  });

  it('공개 응답 schema는 내부 값(raw 상태명·작성자·승인자·digest)을 받지 않는다', () => {
    const summarySchema = requireSchema('legalVersionSummarySchema');
    const summary = {
      versionKey: '2026-11-20',
      status: 'current',
      appliesFrom: '2026-11-20',
      appliesUntil: null,
      changeSummary: '접속 기록 보관 기준을 고쳤습니다.',
      consentRequired: false,
    };

    expect(summarySchema.safeParse(summary).success).toBe(true);
    for (const extra of [
      { contentDigest: 'a'.repeat(64) },
      { requestedByAccountId: 'author' },
      { approvedByAccountId: 'approver' },
      { noticeClass: 'GENERAL' },
      { id: 'privacy-policy-2026-06-22' },
    ]) {
      expect(summarySchema.safeParse({ ...summary, ...extra }).success, Object.keys(extra)[0]).toBe(
        false,
      );
    }
    expect(summarySchema.safeParse({ ...summary, status: 'withdrawn' }).success).toBe(false);
  });

  it('가져오기 초안 schema는 고지 등급별 적용 끝과 재동의 규칙을 지킨다', () => {
    const importSchema = requireSchema('legalDocumentDraftImportSchema');
    const base = {
      kind: 'PRIVACY_POLICY',
      contentSchemaVersion: 1,
      title: '돔두리 개인정보 처리방침',
      summaryItems: ['요약'],
      sections: [heading('제1조(목적)'), paragraph('본문')],
      changeSummary: '변경 요약',
      noticeClass: 'GENERAL',
      consentRequired: false,
      proposedEffectiveDate: '2026-12-01',
    };

    expect(importSchema.safeParse(base).success).toBe(true);
    expect(importSchema.safeParse({ ...base, changeSummary: undefined }).success).toBe(false);
    // The file names its body format; a format with no reader is refused.
    expect(importSchema.safeParse({ ...base, contentSchemaVersion: undefined }).success).toBe(
      false,
    );
    expect(importSchema.safeParse({ ...base, contentSchemaVersion: 2 }).success).toBe(false);
    expect(importSchema.safeParse({ ...base, appliesUntil: '2026-12-31' }).success).toBe(false);
    expect(
      importSchema.safeParse({
        ...base,
        noticeClass: 'HISTORICAL',
        proposedEffectiveDate: '2026-06-22',
        appliesUntil: '2026-11-19',
      }).success,
    ).toBe(true);
    expect(importSchema.safeParse({ ...base, noticeClass: 'HISTORICAL' }).success).toBe(false);
    expect(
      importSchema.safeParse({
        ...base,
        noticeClass: 'HISTORICAL',
        proposedEffectiveDate: '2026-11-20',
        appliesUntil: '2026-11-19',
      }).success,
    ).toBe(false);
    // The privacy policy is shown, not agreed to: it never asks for consent again.
    expect(importSchema.safeParse({ ...base, consentRequired: true }).success).toBe(false);
    const terms = { ...base, kind: 'TERMS_OF_SERVICE', title: '돔두리 이용약관' };
    expect(importSchema.safeParse({ ...terms, noticeClass: 'SIGNIFICANT' }).success).toBe(false);
    expect(
      importSchema.safeParse({ ...terms, noticeClass: 'SIGNIFICANT', consentRequired: true })
        .success,
    ).toBe(true);
    expect(importSchema.safeParse({ ...base, contentDigest: 'a'.repeat(64) }).success).toBe(false);
  });

  it('재동의 기록 요청은 판 id 1~3개만 받고 다른 key·빈 목록·형식이 틀린 id를 거부한다', () => {
    const requestSchema = requireSchema('legalConsentRecordRequestSchema');
    const id = 'terms-of-service-2026-06-22';

    expect(requestSchema.safeParse({ documentVersionIds: [id] }).success).toBe(true);
    expect(
      requestSchema.safeParse({ documentVersionIds: [id, `${id}-b`, `${id}-c`] }).success,
    ).toBe(true);
    for (const [label, body] of [
      ['empty', { documentVersionIds: [] }],
      ['four ids', { documentVersionIds: [id, `${id}-b`, `${id}-c`, `${id}-d`] }],
      ['extra key', { documentVersionIds: [id], userId: 'someone-else' }],
      ['not a string', { documentVersionIds: [42] }],
      ['empty id', { documentVersionIds: [''] }],
      ['no list', {}],
    ] as const) {
      expect(requestSchema.safeParse(body).success, label).toBe(false);
    }
  });

  it('내용 digest 입력은 key 순서와 무관하고 digest에 드는 값이 바뀌면 달라진다', () => {
    const digestInput =
      requireFunction<(content: Record<string, unknown>) => string>('legalContentDigestInput');
    const content = {
      kind: 'PRIVACY_POLICY',
      contentSchemaVersion: 1,
      title: '처리방침',
      summaryItems: ['요약'],
      sections: [{ type: 'heading', level: 2, text: '제1조(목적)' }],
      changeSummary: '변경 요약',
      effectiveDate: '2026-12-01',
      appliesUntil: null,
      noticeClass: 'GENERAL',
      consentRequired: false,
    };
    const reordered = {
      consentRequired: false,
      noticeClass: 'GENERAL',
      appliesUntil: null,
      effectiveDate: '2026-12-01',
      changeSummary: '변경 요약',
      sections: [{ text: '제1조(목적)', level: 2, type: 'heading' }],
      summaryItems: ['요약'],
      title: '처리방침',
      contentSchemaVersion: 1,
      kind: 'PRIVACY_POLICY',
    };

    expect(digestInput(reordered)).toBe(digestInput(content));
    for (const change of [
      { effectiveDate: '2026-12-02' },
      { contentSchemaVersion: 2 },
      { noticeClass: 'SIGNIFICANT' },
      { consentRequired: true },
      { changeSummary: '다른 요약' },
      { sections: [{ type: 'heading', level: 3, text: '제1조(목적)' }] },
    ]) {
      expect(digestInput({ ...content, ...change }), Object.keys(change)[0]).not.toBe(
        digestInput(content),
      );
    }
  });
});
