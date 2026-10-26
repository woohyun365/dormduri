import { getLandingPolicyCopy, type LandingPolicyCopyId } from './landingPolicyCopy';

// Where each policy notice shows on the landing; each keeps its meaning and source (landingPolicyCopy).
// The first screen carries 학교 공식 서비스 아님 and 호실 미보장, visible at 390×844 without scrolling.

export const firstScreenNotices = [
  getLandingPolicyCopy('service_independent_notice'),
  getLandingPolicyCopy('room_selection_not_guaranteed'),
];

export const listNotices = [
  getLandingPolicyCopy('school_system_not_connected'),
  getLandingPolicyCopy('room_selection_not_guaranteed'),
  getLandingPolicyCopy('lifestyle_survey_disclaimer'),
  getLandingPolicyCopy('profile_privacy_warning'),
  getLandingPolicyCopy('support_channel_boundary'),
];

// The row names in the 알아두세요 list.
export const listNoticeTitles: Partial<Record<LandingPolicyCopyId, string>> = {
  school_system_not_connected: '학교 시스템',
  room_selection_not_guaranteed: '기숙사 배정',
  lifestyle_survey_disclaimer: '생활패턴 설문',
  profile_privacy_warning: '개인정보',
  support_channel_boundary: '신고·문의',
};

export const seasonNotice = getLandingPolicyCopy('season_capability_boundary');
export const footerNotice = getLandingPolicyCopy('service_independent_notice');
