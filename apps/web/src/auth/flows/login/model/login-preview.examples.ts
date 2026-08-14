export const LOGIN_PREVIEW_SEASON_STEPS = [
  {
    id: 'off-season',
    label: '비시즌',
    helper: '지난 기록',
    description: '참여했었던 시즌의 매칭 결과를 확인해요.',
    flow: [
      { id: 'season', label: '시즌 확인' },
      { id: 'history', label: '과거 이력 확인' },
    ],
  },
  {
    id: 'season-open',
    label: '시즌 오픈',
    helper: '시즌 등록',
    description: '시즌 등록 후 매칭 시작을 기다려요.',
    flow: [
      { id: 'season', label: '시즌 확인' },
      { id: 'registration', label: '시즌 등록' },
      { id: 'explore', label: '후보·대화' },
    ],
  },
  {
    id: 'season-matching',
    label: '시즌 매칭',
    helper: '후보·요청',
    description: '후보와 대화하고 매칭을 요청해요.',
    flow: [
      { id: 'season', label: '시즌 확인' },
      { id: 'registration', label: '시즌 등록' },
      { id: 'explore', label: '후보·대화' },
      { id: 'request', label: '요청·수락' },
    ],
  },
  {
    id: 'post-match',
    label: '포스트 매치',
    helper: '결과 확인',
    description: '이번 시즌 결과와 활동을 확인해요.',
    flow: [
      { id: 'season', label: '시즌 확인' },
      { id: 'result', label: '매칭 결과 확인' },
      { id: 'activity', label: '활동 이력 확인' },
    ],
  },
] as const;
