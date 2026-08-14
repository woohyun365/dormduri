import { describe, expect, it } from 'vitest';
import {
  createPublicProfileFull,
  createPublicProfileTombstone,
  createSeasonProfileDraftResponse,
} from '@/test/home-profile-detail-fixtures';
import {
  buildPublicProfileIdentityRows,
  buildPublicProfileLifestyleRows,
  resolvePublicProfileIntro,
  resolvePublicProfileTitle,
} from '../profileDetailDisplay.mapper';
import {
  buildSeasonProfileLifestyleRows,
  buildSeasonProfileStatusRows,
  formatSeasonProfileIntro,
} from '../seasonProfileDisplay.mapper';

describe('home profile detail display mappers', () => {
  it('current season profile contract를 user-facing status/lifestyle rows로 변환한다', () => {
    const profile = createSeasonProfileDraftResponse();

    expect(buildSeasonProfileStatusRows(profile)).toEqual(
      expect.arrayContaining([
        { label: '프로필 상태', value: '시즌 참여 완료' },
        { label: '작성 상태', value: '완료' },
        { label: '학년', value: '2학년' },
        { label: 'MBTI', value: 'INTJ' },
      ]),
    );
    expect(buildSeasonProfileLifestyleRows(profile)).toEqual(
      expect.arrayContaining([
        { label: '취침 시간', value: '22~24시' },
        { label: '흡연 여부', value: '비흡연' },
      ]),
    );
    expect(formatSeasonProfileIntro(profile)).toContain('조용한 생활');
  });

  it('PublicProfile FULL/TOMBSTONE allowlist만 display row로 변환한다', () => {
    const full = createPublicProfileFull();
    const tombstone = createPublicProfileTombstone();

    expect(buildPublicProfileIdentityRows(full)).toEqual(
      expect.arrayContaining([
        { label: '닉네임', value: '감자친구' },
        { label: '캠퍼스', value: '춘천캠퍼스' },
        { label: '매칭도', value: '92%' },
      ]),
    );
    expect(buildPublicProfileLifestyleRows(full)).toEqual(
      expect.arrayContaining([
        { label: '취침 시간', value: '22~24시' },
        { label: '방 청소', value: '눈에 띄면 정리해요' },
      ]),
    );
    expect(resolvePublicProfileTitle(tombstone, '대체 이름')).toBe('상대 프로필');
    expect(resolvePublicProfileIntro(tombstone)).toBe(
      '현재는 상대 프로필 상세 정보를 볼 수 없어요.',
    );
    expect(buildPublicProfileLifestyleRows(tombstone)).toEqual([]);
  });
});
