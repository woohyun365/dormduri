import { describe, expect, it } from 'vitest';
import { mapRoommateSearchManifest } from '../roommateSearchManifestModel';
import {
  buildRoommateFilterSheetViewModel,
  compactRoommateFilterDraft,
  createRoommateFilterDraft,
  setRoommateFilterDraftMbtiTrait,
  setRoommateFilterDraftMinScore,
  setRoommateFilterDraftOperator,
  setRoommateFilterDraftScalar,
  toggleRoommateFilterDraftValue,
} from '../roommateFilterSheetModel';
import {
  createCampusMergedManifest,
  createManifest,
  createPostMatchManifest,
} from '../../search/__tests__/roommateSearchTestFixtures';

const actionableManifest = mapRoommateSearchManifest(createManifest());

describe('roommateFilterSheetModel', () => {
  it('manifest enabled fields만 sheet field로 만들고 active chip label을 유지한다', () => {
    const query = {
      scope: 'SAME_BUILDING_ONLY' as const,
      sort: 'MATCH_SCORE' as const,
      filters: {
        smokingBehavior: 'NO',
        college: { operator: 'EXCLUDE' as const, values: ['ENGINEERING'] },
      },
    };

    const viewModel = buildRoommateFilterSheetViewModel(actionableManifest, query);

    expect(viewModel.canOpen).toBe(true);
    expect(viewModel.fields.map((field) => field.key)).toEqual(
      actionableManifest.enabledFilterKeys,
    );
    expect(viewModel.activeChips).toContainEqual({
      key: 'smokingBehavior',
      label: '흡연 여부',
      valueLabel: '비흡연',
    });
    expect(viewModel.activeChips).toContainEqual({
      key: 'college',
      label: '단과대',
      valueLabel: '공과대학 제외',
    });
    expect(viewModel.fields.find((field) => field.key === 'ageBand')?.helperText).toContain(
      '한국식 나이',
    );
  });

  it('CAMPUS_MERGED처럼 filter가 닫힌 manifest는 field를 만들지 않는다', () => {
    const viewModel = buildRoommateFilterSheetViewModel(
      mapRoommateSearchManifest(createCampusMergedManifest()),
      { scope: 'CAMPUS_MERGED', sort: 'NICKNAME', filters: { smokingBehavior: 'NO' } },
    );

    expect(viewModel.canOpen).toBe(false);
    expect(viewModel.fields).toEqual([]);
    expect(viewModel.policyCopy).toContain('조건 필터를 사용할 수 없어요');
  });

  it('POST_MATCH_COHORT_REVIEW manifest도 filter sheet를 닫고 draft submit payload를 제거한다', () => {
    const manifest = mapRoommateSearchManifest(createPostMatchManifest());
    const viewModel = buildRoommateFilterSheetViewModel(manifest, {
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      filters: { sleepHabit: 'HAS', minScore: 80 },
    });

    expect(viewModel.canOpen).toBe(false);
    expect(viewModel.fields).toEqual([]);
    expect(compactRoommateFilterDraft({ sleepHabit: 'HAS', minScore: 80 }, manifest)).toEqual({});
  });

  it('operator-only draft도 값 선택 전 모달 상태에 유지한다', () => {
    const draft = setRoommateFilterDraftOperator(
      createRoommateFilterDraft({}),
      'college',
      'EXCLUDE',
    );

    const viewModel = buildRoommateFilterSheetViewModel(
      actionableManifest,
      { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE', filters: {} },
      draft,
    );
    const collegeField = viewModel.fields.find((field) => field.key === 'college');

    expect(collegeField?.selectedOperator).toBe('EXCLUDE');
    expect(collegeField?.options.every((option) => option.selected === false)).toBe(true);
    expect(compactRoommateFilterDraft(draft, actionableManifest)).toEqual({});
  });

  it('draft helper는 scalar/operator/multi/mbti/minScore payload를 manifest query shape로 compact한다', () => {
    let draft = createRoommateFilterDraft({});
    draft = setRoommateFilterDraftScalar(draft, 'smokingBehavior', 'NO');
    draft = setRoommateFilterDraftOperator(draft, 'college', 'EXCLUDE');
    draft = toggleRoommateFilterDraftValue(draft, 'college', 'ENGINEERING');
    draft = toggleRoommateFilterDraftValue(draft, 'ageBand', '25_PLUS');
    draft = toggleRoommateFilterDraftValue(draft, 'ageBand', '20');
    draft = setRoommateFilterDraftMbtiTrait(draft, 'energy', 'E');
    draft = setRoommateFilterDraftMinScore(draft, 80);

    expect(compactRoommateFilterDraft(draft, actionableManifest)).toEqual({
      smokingBehavior: 'NO',
      college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
      mbtiTraits: { energy: 'E' },
      ageBand: { values: ['20', '25_PLUS'] },
      minScore: 80,
    });
  });

  it('manifest에서 disabled/unknown인 draft 값은 제출 payload에서 제거한다', () => {
    const manifest = mapRoommateSearchManifest(createCampusMergedManifest());

    expect(
      compactRoommateFilterDraft(
        {
          smokingBehavior: 'NO',
          college: { operator: 'EXCLUDE', values: ['ENGINEERING'] },
          minScore: 80,
        },
        manifest,
      ),
    ).toEqual({});
  });

  it('grade와 ageBand draft 값은 선택 순서와 무관하게 낮은 값부터 정렬한다', () => {
    let draft = createRoommateFilterDraft({});
    draft = toggleRoommateFilterDraftValue(draft, 'grade', '4+');
    draft = toggleRoommateFilterDraftValue(draft, 'grade', '1');
    draft = toggleRoommateFilterDraftValue(draft, 'ageBand', '25_PLUS');
    draft = toggleRoommateFilterDraftValue(draft, 'ageBand', '20');

    expect(compactRoommateFilterDraft(draft, actionableManifest)).toMatchObject({
      grade: { operator: 'INCLUDE', values: ['1', '4+'] },
      ageBand: { values: ['20', '25_PLUS'] },
    });
  });
});
