import { getCollegeLabel, type CollegeCode } from '@repo/shared/college';
import type { Campus, Gender } from '@repo/shared/auth';
import type { SeasonAdditionalProfileDraft } from '@repo/shared/profile/contract';

const CAMPUS_DISPLAY_NAMES: Record<Campus, string> = {
  CHUNCHEON: '춘천캠퍼스',
  SAMCHEOK: '삼척캠퍼스',
  DOGYE: '도계캠퍼스',
};

const GRADE_DISPLAY_LABELS: Record<NonNullable<SeasonAdditionalProfileDraft['grade']>, string> = {
  '1': '1학년',
  '2': '2학년',
  '3': '3학년',
  '4+': '4학년 이상',
};

export function formatCampusName(campus: Campus): string {
  return CAMPUS_DISPLAY_NAMES[campus];
}

export function formatGenderLabel(gender: Gender): string {
  return gender === 'M' ? '남' : '여';
}

export function formatGenderNoun(gender: Gender): string {
  return gender === 'M' ? '남성' : '여성';
}

export function formatCollegeName(
  college: CollegeCode | null | undefined,
  fallback: string = '미입력',
): string {
  return getCollegeLabel(college) ?? fallback;
}

export function formatGradeLabel(
  grade: SeasonAdditionalProfileDraft['grade'] | null | undefined,
  fallback: string = '미입력',
): string {
  return grade ? GRADE_DISPLAY_LABELS[grade] : fallback;
}
