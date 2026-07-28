import { describe, expect, it } from 'vitest';
import { parseDisplayIdentityNickname } from '@repo/shared/user/identity/display';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import * as moderationReferenceModule from '../../../prisma/seeds/reference/moderation/moderation-reference-data.js';
// @ts-expect-error -- fixture seed data is plain JS and intentionally imported for regression coverage
import { AUTH_FIXTURE_USERS } from '../../../prisma/seed-data/fixtures/auth-fixture-users.js';
import {
  matchesModerationTerm,
  normalizeForModeration,
} from '../../moderation/text-moderation.policy.js';

type ModerationReferenceRow = {
  referenceKey: string;
  term: string;
  normalizedTerm: string;
  category: 'BLOCKED_TEXT' | 'RESERVED_NICKNAME';
  matchMode: 'EXACT' | 'INCLUDES' | 'PREFIX';
  surface: 'ALL' | 'NICKNAME' | 'INTRO';
  policyCategory:
    | 'PROFANITY_INSULT'
    | 'SEXUALLY_EXPLICIT'
    | 'HATE_SLUR'
    | 'HARASSMENT'
    | 'ABBREVIATED_ABUSE'
    | 'RESERVED_IDENTITY';
  isActive: boolean;
};

type ModerationReferenceModule = {
  MODERATION_REFERENCE_DATA: ModerationReferenceRow[];
  validateModerationReferenceData: () => void;
};

const { MODERATION_REFERENCE_DATA, validateModerationReferenceData } =
  moderationReferenceModule as unknown as ModerationReferenceModule;
const rows = MODERATION_REFERENCE_DATA;

describe('moderation reference data', () => {
  it('manifest key와 DB policy identity가 모두 유일하다', () => {
    expect(() => validateModerationReferenceData()).not.toThrow();
    expect(new Set(rows.map((row) => row.referenceKey)).size).toBe(rows.length);
    expect(
      new Set(
        rows.map((row) => [row.normalizedTerm, row.category, row.matchMode, row.surface].join(':')),
      ).size,
    ).toBe(rows.length);
  });

  it('한국어·영문 고신뢰 범주와 영문 PREFIX 정책을 함께 제공한다', () => {
    expect(new Set(rows.map((row) => row.policyCategory))).toEqual(
      new Set([
        'PROFANITY_INSULT',
        'SEXUALLY_EXPLICIT',
        'HATE_SLUR',
        'HARASSMENT',
        'ABBREVIATED_ABUSE',
        'RESERVED_IDENTITY',
      ]),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'sex',
        matchMode: 'PREFIX',
        surface: 'ALL',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '자살해',
        policyCategory: 'HARASSMENT',
        surface: 'NICKNAME',
      }),
    );
  });

  it('맥락에 따라 자기표현이 가능한 정체성 용어는 blacklist에 넣지 않는다', () => {
    const normalizedTerms = rows.map((row) => row.normalizedTerm);

    expect(normalizedTerms).not.toContain('게이');
    expect(normalizedTerms).not.toContain('장애인');
    expect(normalizedTerms).not.toContain('외국인');
  });

  it('모욕·혐오·성적 표현을 의미에 맞는 domain으로 분류한다', () => {
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '멍청이',
        policyCategory: 'PROFANITY_INSULT',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '저능아',
        policyCategory: 'HATE_SLUR',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'ㅂㅃ',
        policyCategory: 'SEXUALLY_EXPLICIT',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '피싸개',
        policyCategory: 'HATE_SLUR',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '앰생',
        policyCategory: 'PROFANITY_INSULT',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'ㄷㅈㄹ',
        policyCategory: 'HARASSMENT',
      }),
    );
    expect(rows).not.toContainEqual(expect.objectContaining({ term: '재기' }));
  });

  it('정상 문장 오탐 위험이 큰 단일 어근은 ALL INCLUDES로 등록하지 않는다', () => {
    expect(rows).not.toContainEqual(
      expect.objectContaining({
        term: '씹',
        matchMode: 'INCLUDES',
        surface: 'ALL',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '호로',
        matchMode: 'EXACT',
        surface: 'NICKNAME',
      }),
    );
  });

  it('기존 어근으로 탐지되는 젠더 혐오 파생어는 중복 등록하지 않는다', () => {
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '한남',
        matchMode: 'INCLUDES',
      }),
    );
    expect(rows).not.toContainEqual(expect.objectContaining({ term: '한남충' }));
    expect(rows).not.toContainEqual(expect.objectContaining({ term: '한남유충' }));
  });

  it('정상 단어와 충돌하는 젠더 갈등 축약 어근은 단독 등록하지 않는다', () => {
    expect(rows).not.toContainEqual(expect.objectContaining({ term: '소추' }));
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '소추남',
        policyCategory: 'HATE_SLUR',
      }),
    );
  });

  it('서비스 문맥에서 성적 접근 의미가 우세한 표현을 차단한다', () => {
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '파트너',
        policyCategory: 'SEXUALLY_EXPLICIT',
      }),
    );
    expect(rows).not.toContainEqual(expect.objectContaining({ term: '대물' }));
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: '대물남',
        policyCategory: 'SEXUALLY_EXPLICIT',
      }),
    );
  });

  it('성적 신체 표현·제안·성향·초성·영문 우회를 SEXUALLY_EXPLICIT domain에 둔다', () => {
    for (const term of [
      'ㅍㅌㄴ',
      '거유',
      '빈유',
      '물빼줄',
      '야챗',
      '슴가',
      '젖탱이',
      '애무',
      '사까시',
      '똥까시',
      '빨아줄',
      '아다',
      '후다',
      '보추',
      '육덕',
      '성욕',
      '도미넌트',
      '디그레이디',
      'fwb',
      'bdsm',
    ]) {
      expect(rows).toContainEqual(
        expect.objectContaining({
          term,
          policyCategory: 'SEXUALLY_EXPLICIT',
        }),
      );
    }
  });

  it('짧고 정상 문맥 충돌이 큰 신체·성향·경험 단어는 public surface exact로 제한한다', () => {
    for (const term of ['젖', '돔', '섭', '그레이디', '아다', '후다']) {
      expect(rows).toContainEqual(
        expect.objectContaining({
          term,
          policyCategory: 'SEXUALLY_EXPLICIT',
          matchMode: 'EXACT',
          surface: 'ALL',
        }),
      );
    }
  });

  it('한글 욕설의 로마자·영문 키보드 우회 표현도 같은 의미 domain에 둔다', () => {
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'ssibal',
        policyCategory: 'PROFANITY_INSULT',
        matchMode: 'PREFIX',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'tlqkf',
        policyCategory: 'PROFANITY_INSULT',
        matchMode: 'PREFIX',
      }),
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        term: 'incel',
        policyCategory: 'HATE_SLUR',
        matchMode: 'PREFIX',
      }),
    );
  });

  it('젠더 혐오와 직접적인 위해 요구가 결합된 문구를 각 domain에서 탐지한다', () => {
    const normalizedValue = normalizeForModeration('한남충새끼들 뒤져라');
    const matchingCategories = new Set(
      rows
        .filter((row) => row.surface === 'ALL')
        .filter((row) =>
          matchesModerationTerm(normalizedValue, {
            term: row.term,
            normalizedTerm: row.normalizedTerm,
            matchMode: row.matchMode,
          }),
        )
        .map((row) => row.policyCategory),
    );

    expect([...matchingCategories]).toEqual(
      expect.arrayContaining(['HATE_SLUR', 'PROFANITY_INSULT', 'HARASSMENT']),
    );
  });

  it('일반 행정 용어와 견종은 젠더 갈등·욕설 어근으로 오탐하지 않는다', () => {
    const activeTerms = rows.filter((row) => row.isActive && row.surface === 'ALL');
    const isBlocked = (value: string) =>
      activeTerms.some((term) =>
        matchesModerationTerm(normalizeForModeration(value), {
          term: term.term,
          normalizedTerm: term.normalizedTerm,
          matchMode: term.matchMode,
        }),
      );

    expect(isBlocked('검찰이 공소를 소추하다')).toBe(false);
    expect(isBlocked('시바견을 좋아해요')).toBe(false);
    expect(isBlocked('대물 낚시를 좋아해요')).toBe(false);
    expect(isBlocked('고척 돔구장에서 야구를 봐요')).toBe(false);
    expect(isBlocked('비에 젖은 옷을 말렸어요')).toBe(false);
    expect(isBlocked('후다닥 씻고 자요')).toBe(false);
    expect(isBlocked('아다지오를 즐겨 들어요')).toBe(false);
    expect(isBlocked('젖')).toBe(true);
    expect(isBlocked('돔')).toBe(true);
  });

  it('성적 성향·관계 탐색 문구는 공개 텍스트에서 탐지한다', () => {
    const activeTerms = rows.filter((row) => row.isActive && row.surface === 'ALL');
    const matchingTerms = (value: string) =>
      activeTerms
        .filter((term) =>
          matchesModerationTerm(normalizeForModeration(value), {
            term: term.term,
            normalizedTerm: term.normalizedTerm,
            matchMode: term.matchMode,
          }),
        )
        .map((term) => term.term);

    expect(matchingTerms('나는 돔 성향이고 FWB를 찾아요')).toEqual(
      expect.arrayContaining(['돔성향', 'fwb']),
    );
    expect(matchingTerms('ㅍㅌㄴ 구함')).toContain('ㅍㅌㄴ');
  });

  it('current user seed fixture는 구조·moderation 정책을 모두 통과한다', () => {
    const activeTerms = rows.filter((row) => row.isActive);

    for (const fixture of AUTH_FIXTURE_USERS as Array<{ nickname: string }>) {
      const parsed = parseDisplayIdentityNickname(fixture.nickname);
      expect(parsed).toMatchObject({ ok: true });
      if (!parsed.ok) continue;

      expect(
        activeTerms.some((term) =>
          matchesModerationTerm(parsed.normalized, {
            term: term.term,
            normalizedTerm: term.normalizedTerm,
            matchMode: term.matchMode,
          }),
        ),
      ).toBe(false);
    }
  });
});
