import { describe, expect, it } from 'vitest';
import type { RoommateSearchManifest } from '@repo/shared/roommate-search/contract';
import { assertRoommateSearchQueryAllowed } from './roommate-search-query.policy.js';

const actionableManifest: RoommateSearchManifest = {
  manifestRevision: 'test',
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  filters: {
    enabled: true,
    fields: {
      smokingBehavior: { enabled: true, source: 'LIFESTYLE_FIELD_OPTIONS' },
      college: {
        enabled: true,
        source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
        operators: ['INCLUDE', 'EXCLUDE'],
        options: [
          { code: 'IT', label: 'IT대' },
          { code: 'NURSING', label: '간호대' },
        ],
      },
      grade: {
        enabled: true,
        source: 'PROFILE_ENUM',
        operators: ['INCLUDE'],
        options: [{ code: '3', label: '3' }],
      },
      ageBand: {
        enabled: true,
        source: 'AGE_BAND',
        options: [{ code: '24', label: '24세' }],
      },
      minScore: {
        enabled: true,
        source: 'MATCH_SCORE_PRESET',
        options: [
          { code: '90', label: '90점 이상' },
          { code: '80', label: '80점 이상' },
          { code: '70', label: '70점 이상' },
          { code: '60', label: '60점 이상' },
        ],
      },
    },
  },
  sorts: {
    default: 'MATCH_SCORE',
    options: ['NICKNAME', 'MATCH_SCORE'],
  },
};

describe('roommate-search-query-policy', () => {
  it('manifest가 닫은 scope에서는 필터와 미지원 sort를 fail-closed한다', () => {
    const broadPreviewManifest: RoommateSearchManifest = {
      ...actionableManifest,
      scope: 'CAMPUS_MERGED',
      purpose: 'BROAD_PREVIEW',
      filters: { enabled: false, fields: {} },
      sorts: { default: 'NICKNAME', options: ['NICKNAME'] },
    };

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: { scope: 'CAMPUS_MERGED', smokingBehavior: 'NO', limit: 20 },
        manifest: broadPreviewManifest,
      }),
    ).toThrow();

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: { scope: 'CAMPUS_MERGED', sort: 'MATCH_SCORE', limit: 20 },
        manifest: broadPreviewManifest,
      }),
    ).toThrow();
  });

  it('minScore preset만 요청해도 MATCH_SCORE sort로 정규화하고 queryDigest 대상 필터로 취급한다', () => {
    expect(
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          minScore: 70,
          limit: 20,
        },
        manifest: actionableManifest,
      }),
    ).toEqual({
      appliedSort: 'MATCH_SCORE',
      requestedFilterFields: ['minScore'],
    });

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          minScore: 70,
          sort: 'NICKNAME',
          limit: 20,
        },
        manifest: actionableManifest,
      }),
    ).toThrow();
  });

  it('college/grade/ageBand는 manifest option과 operator 범위를 기준으로 검증한다', () => {
    expect(
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          college: { operator: 'EXCLUDE', values: ['IT'] },
          grade: { operator: 'INCLUDE', values: ['3'] },
          ageBand: { values: ['24'] },
          limit: 20,
        },
        manifest: actionableManifest,
      }).requestedFilterFields,
    ).toEqual(['college', 'grade', 'ageBand']);

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          college: { operator: 'INCLUDE', values: ['ARTS_ENGINEERING'] },
          limit: 20,
        },
        manifest: actionableManifest,
      }),
    ).toThrow();

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          grade: { operator: 'EXCLUDE', values: ['3'] },
          limit: 20,
        },
        manifest: actionableManifest,
      }),
    ).toThrow();
  });

  it('excludeMyCollege shortcut과 legacy include/exclude shape를 compatibility bridge 없이 거부한다', () => {
    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: { scope: 'SAME_BUILDING_ONLY', excludeMyCollege: true, limit: 20 } as never,
        manifest: actionableManifest,
      }),
    ).toThrow();

    expect(() =>
      assertRoommateSearchQueryAllowed({
        query: {
          scope: 'SAME_BUILDING_ONLY',
          college: { include: ['IT'], exclude: ['NURSING'] },
          limit: 20,
        } as never,
        manifest: actionableManifest,
      }),
    ).toThrow();
  });
});
