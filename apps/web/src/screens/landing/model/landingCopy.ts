import { LANDING_SURFACE_SECTION_IDS } from './landingPolicyCopy';

// Copy and data for the landing. Policy notices come from ./landingPolicyCopy; the rest is screen copy
// that tests and stories import instead of pinning it (README, 검증).

export const landingCopy = {
  serviceName: 'KNU 룸메',
  loginLabel: '로그인',
  // The sign-up action's one name on the whole page.
  primaryCtaLabel: '학교 이메일로 시작하기',
  // The header's short name for the sign-up action, the one exception to one name per action: the full
  // name overflows the header at 320 and 360px.
  startLabel: '시작하기',
  // The hero title in two lines; the glow marks the accent word.
  heroTitle: { lead: '기숙사 룸메이트,', accent: '생활패턴', rest: '부터 맞춰 보고 정해요' },
  // Word joiners keep 수면·생활습관 on one line; narrow phones broke it before the middle dot.
  body: '학교 이메일로 인증한 같은 기숙사 학생끼리 수면⁠·⁠생활습관을 항목별로 비교하고, 대화해 본 뒤 매칭을 정해요.',
  // Under the hero's sign-up action, in line with the FAQ: before registering a visitor sees summaries,
  // and registering opens the chat.
  heroCtaResult: '가입하고 시즌에 등록하면 같은 기숙사 후보와 대화할 수 있어요.',
  exampleTag: '예시',
  noticesTitle: '알아두세요',
  noticesLead: '가입 전에 꼭 확인해 주세요.',
  faqTitle: '자주 묻는 질문',
  // 학기, the word visitors use, over 시즌.
  closingTitle: '이번 학기 룸메이트, 생활패턴부터 맞춰 봐요',
  footer: {
    serviceLabel: '서비스',
    legalNavLabel: '약관과 정책',
    termsLabel: '이용약관',
    privacyLabel: '개인정보처리방침',
    inquiryLabel: '서비스 외부 문의',
    // The inquiry address is text, not a link; it stays a placeholder until the Owner sets the address.
    inquiryPlaceholder: '문의 주소(텍스트) 자리',
  },
} as const;

// The season section: what a season is and, as a lane over a year, that season registration comes in
// the two season windows, each season anew. No 가입 lane: signing up is open all year (the FAQ says
// it). From docs/policies/season-lifecycle.md: once a semester and twice a year, preparation from 1/1
// and 7/1 and the season over by 2/28 and 8/31 (설계 근거, prisma seed defaults).
export const seasonExplain = {
  eyebrow: '시즌',
  lead: '시즌은 학기마다 열리는 룸메이트 찾기 기간이에요.',
  lanes: {
    months: Array.from({ length: 12 }, (_, index) => `${index + 1}월`),
    season: { name: '시즌 등록', note: '시즌마다' },
    // The bars show the months on the year; `months` says them to assistive technology too.
    seasons: [
      { name: '1학기 시즌', months: '1~2월' },
      { name: '2학기 시즌', months: '7~8월' },
    ],
  },
} as const;

// The FAQ, in the order a visitor meets the service. Each answer follows docs/policies: who signs up
// (access-eligibility.md 가입 자격), what shows before and after season registration
// (season-lifecycle.md 상태별 기능 허용 범위), how a match forms, 생활패턴 적합도 as the steps and the
// main page name it, and a new season profile each season (profile-model.md: nothing carries over to
// the next season).
export const faqItems = [
  {
    question: '누가 가입할 수 있나요?',
    answer: '학교 이메일로 인증한 재학생이면 가입할 수 있어요. 가입은 1년 내내 할 수 있어요.',
  },
  {
    question: '가입하면 바로 후보를 볼 수 있나요?',
    answer:
      '같은 기숙사 후보는 시즌 중에 볼 수 있어요. 시즌 등록하면 자세한 프로필 정보와 대화가 열려요.',
  },
  {
    question: '매칭은 어떻게 정해지나요?',
    answer:
      '같은 기숙사 후보에게 매칭을 신청하고 상대가 수락하면 매칭돼요. 매칭 신청은 시즌 매칭 기간에 열려요.',
  },
  {
    question: '생활패턴 적합도가 높으면 잘 맞는 건가요?',
    answer: '적합도는 생활패턴 항목을 견준 참고 값이에요. 항목별 차이를 보고 대화로 확인해 보세요.',
  },
  {
    question: '다음 시즌에도 다시 등록해야 하나요?',
    answer: '네. 시즌 등록은 시즌마다 새로 해요. 지난 시즌 프로필은 다음 시즌으로 넘어가지 않아요.',
  },
] as const;

// The 무엇이 다른가요 section: its label and its heading, whose second line is muted. 적합도 is the
// page's word for the comparison. The section has no body line: the hero and the steps already say
// compare, chat, match.
export const beforeTitle = {
  eyebrow: '무엇이 다른가요',
  lead: '체크리스트에 동그라미 치고 올리던 방식,',
  rest: '이제 생활패턴 적합도로 바로 봐요.',
} as const;

// The two answer sheets under the statement, laid one on the other by the visitor. My sheet outlines
// what I accept from a roommate (the survey's conditions).
export const pairSheets = {
  title: '생활패턴 적합도 계산 항목',
  pairUnit: '쌍',
  mine: { title: '나', note: '생활습관 비교 · 상대에게 바라는 조건', listLabel: '나의 답' },
  theirs: { title: '상대', note: '상대의 생활패턴', listLabel: '상대의 답', fieldPrefix: '상대의' },
  join: '겹쳐 보기',
  part: '떼어 보기',
  status: {
    apart: '상대의 생활패턴 카드를 끌어 겹쳐 보세요.',
    // Stacked cards (phones) do not drag, so this line names the button.
    apartTap: '겹쳐 보기를 눌러 생활패턴 카드를 겹쳐 보세요.',
    partway: '조금 더 겹치면 쌍이 만나요.',
    met: '내가 원하는 조건과 상대를 비교해요.',
  },
} as const;

// The statement after 무엇이 다른가요. The struck-through words are what a roommate left to luck can
// bring, so the line through them says the service takes them away; the lead names that old way.
export const luckStatement = {
  lead: '운에 맡기던 룸메이트 정하기',
  ghost: ['운', '후회', '스트레스'],
  before: '같이 살기 편한지는',
  keyword: '생활패턴',
  after: '에서 보여요',
  body: '실제 설문 항목 그대로예요. 서로 원하는 잠, 소리, 생활습관을 프로필로 구성하고 항목별로 비교해요.',
} as const;

// The three steps (01 찾기 · 02 대화 · 03 매칭), worded by what the service has: score order and
// per-item fit (roommate-searching), chat before a match is allowed but not required (chat-lifecycle,
// matching-lifecycle).
export const flowSteps = {
  search: {
    label: '찾기',
    title: '같은 기숙사 후보를 생활패턴으로 찾아요',
    body: '같은 기숙사 후보가 생활패턴 적합도가 높은 순으로 보여요.\n후보를 누르면 항목별 적합도를 볼 수 있어요.',
  },
  chat: {
    label: '대화',
    title: '맞지 않는 항목은 먼저 물어봐요',
    body: '매칭 전에도 같은 기숙사 후보와 대화할 수 있어요.\n궁금한 항목은 직접 물어보고, 대화 없이 바로 매칭을 신청해도 돼요.',
  },
  match: {
    label: '매칭',
    title: '서로 수락해야 매칭돼요',
    body: '매칭을 신청하면 상대 화면에 알림이 가요.\n상대가 수락하면 매칭돼요.',
  },
} as const;

export type FlowStepId = keyof typeof flowSteps;

export const flowStepOrder = ['search', 'chat', 'match'] as const satisfies readonly FlowStepId[];

// The name of each step's list of links to the three steps.
export const flowStepsLabel = '체험 순서';

// Element ids of the sections the hero question box and the step links go to. Each section takes its
// id from here, so a target cannot drift from its section.
export const landingSectionIds = {
  before: 'before',
  items: 'items',
  search: 'search',
  chat: 'chat',
  match: 'match',
  season: LANDING_SURFACE_SECTION_IDS.season,
} as const satisfies Record<'before' | 'items' | FlowStepId | 'season', string>;

export type LandingSectionId = keyof typeof landingSectionIds;

// The two overlapping cards of the 무엇이 다른가요 section and the switch that brings one forward.
export const beforeStack = {
  switchLabel: '앞에 볼 화면',
  labels: { post: '지금까지 · 커뮤니티 게시판', service: '이제는 · 서비스 안에서' },
} as const;

// The invented example post on the 지금까지 card: a campus community post seen in a browser, with a
// checklist image marked up in an editor. No text, school name, mark or app name comes from a real
// post; the address is a reserved example domain.
export const examplePost = {
  tab: '룸메이트 구해요 게시판',
  url: 'board.example.com/roommate/1024',
  author: '익명',
  time: '08/14 23:41',
  actions: '쪽지 · 신고',
  title: 'A관 룸메 구합니다',
  // Follows the example tag: "예시 글".
  tagNoun: '글',
  lines: [
    '서로 배려하면서 조용히 지낼 룸메 구해요',
    '자는 시간이 조금 늦은 편이에요',
    '체크리스트에 표시해서 올려요',
  ],
  checklist: { title: '룸메 체크리스트', mine: '나', wanted: '원하는 룸메' },
  tools: { pen: '펜', highlighter: '형광펜', eraser: '지우개', undo: '되돌리기' },
  reactions: { like: '공감', comment: '댓글', scrap: '스크랩' },
} as const;

// The three steps' capture slots: what to capture from the main tabs once the main page is settled,
// at 390×844 (Storybook fixtures, no real people: RoommateListTab season-matching.search and .detail,
// ChatTab season-matching.threads, RoommateListTab season-matching.action.match-request, MatchingTab
// season-matching.action.accept).
export const stepCaptures = {
  size: '휴대폰 캡처 자리 · 390×844',
  search: [
    { caption: '후보 목록', slot: '룸메 찾기 · 적합도 순 후보 목록' },
    { caption: '후보 상세', slot: '후보 상세 · 항목별 적합도' },
  ],
  chat: [
    { caption: '대화 목록', slot: '채팅 · 대화 목록' },
    { caption: '대화방', slot: '채팅 · 대화방' },
  ],
  match: [
    { caption: '내 화면', slot: '후보 상세 · 매칭 요청' },
    { caption: '상대 화면', slot: '매칭 현황 · 받은 요청' },
  ],
} as const;

// The 이제는 · 서비스 안에서 card: a gray slot until a capture of the main page exists. The address is
// a reserved example domain.
export const serviceWindow = {
  tab: 'KNU 룸메',
  url: 'knu-roommate.example.com/main',
  slot: '메인페이지',
  size: '메인 페이지 캡처 자리 · 16:10',
} as const;

// Hero question box, in place of a search bar, which read like a real feature; the header keeps no
// section menu. The box cycles these questions and goes to the section that answers the one it shows
// (`target`). Dates stay on the main page.
export const heroAsk = {
  goLabel: '이 내용으로 이동',
  pauseLabel: '질문 자동 넘김 멈춤',
  playLabel: '질문 자동 넘김 재생',
  items: [
    { target: 'before', question: '기존 방식과는 무엇이 달라요?' },
    { target: 'items', question: '서로 잘 맞는지 어떻게 알아요?' },
    { target: 'search', question: '룸메이트는 어떻게 찾아요?' },
    // The 03 매칭 step answers this one (chat comes before it but is optional).
    { target: 'match', question: '매칭은 어떻게 돼요?' },
    { target: 'season', question: '시즌이 뭐예요?' },
    { target: 'season', question: '시즌은 언제 열려요?' },
  ],
} as const satisfies {
  goLabel: string;
  pauseLabel: string;
  playLabel: string;
  items: readonly { target: LandingSectionId; question: string }[];
};
