export const CAMPUS_MASTER_DATA = [
  { code: 'CHUNCHEON', nameKo: '춘천캠퍼스', isOperated: true, sortOrder: 1 },
  { code: 'SAMCHEOK', nameKo: '삼척캠퍼스', isOperated: false, sortOrder: 2 },
  { code: 'DOGYE', nameKo: '도계캠퍼스', isOperated: false, sortOrder: 3 },
];

const DEFAULT_COMMON_RULES = [
  { emoji: '🕐', label: '통금', value: '01:00 ~ 05:00' },
  { emoji: '🚭', label: '실내 흡연', value: '즉시 퇴사 (전자담배 포함)' },
  { emoji: '🍺', label: '음주', value: '주류 반입/음주 시 퇴사 (빈병 포함)' },
  { emoji: '🔥', label: '실내 조리', value: '불·열기구 사용 금지 (배달/간편식은 OK)' },
  { emoji: '🚫', label: '금지물품', value: '냉장고, 전기포트, 전기장판, 선풍기 등' },
];

const DEFAULT_EMERGENCY_CONTACTS = [
  { label: '야간·공휴일 콜센터', value: '033-250-8067' },
  { label: '관생 일반문의 (주간)', value: '033-250-8073' },
  { label: '수납/환불 문의', value: '033-250-8052' },
];

const DEFAULT_HOMEPAGE_URL = 'https://knudorm.kangwon.ac.kr/index.knu';

export const CAMPUS_GUIDE_CONTENT_DATA = [
  {
    campusCode: 'CHUNCHEON',
    homepageUrl: DEFAULT_HOMEPAGE_URL,
    commonRules: DEFAULT_COMMON_RULES,
    emergencyContacts: DEFAULT_EMERGENCY_CONTACTS,
  },
  {
    campusCode: 'SAMCHEOK',
    homepageUrl: DEFAULT_HOMEPAGE_URL,
    commonRules: DEFAULT_COMMON_RULES,
    emergencyContacts: DEFAULT_EMERGENCY_CONTACTS,
  },
  {
    campusCode: 'DOGYE',
    homepageUrl: DEFAULT_HOMEPAGE_URL,
    commonRules: DEFAULT_COMMON_RULES,
    emergencyContacts: DEFAULT_EMERGENCY_CONTACTS,
  },
];

export const DORMITORY_MASTER_DATA = [
  {
    id: 'toegye',
    campusCode: 'CHUNCHEON',
    nameKo: '퇴계관',
    roomType: 3,
    genderPolicy: 'M',
    sortOrder: 1,
  },
  {
    id: 'dasan',
    campusCode: 'CHUNCHEON',
    nameKo: '다산관',
    roomType: 2,
    genderPolicy: 'M',
    sortOrder: 2,
  },
  {
    id: 'yeji',
    campusCode: 'CHUNCHEON',
    nameKo: '예지원',
    roomType: 2,
    genderPolicy: 'F',
    sortOrder: 3,
  },
  {
    id: 'nanji',
    campusCode: 'CHUNCHEON',
    nameKo: '난지원',
    roomType: 3,
    genderPolicy: 'F',
    sortOrder: 4,
  },
  {
    id: 'gukji',
    campusCode: 'CHUNCHEON',
    nameKo: '국지원',
    roomType: 3,
    genderPolicy: 'F',
    sortOrder: 5,
  },
  {
    id: 'saerom',
    campusCode: 'CHUNCHEON',
    nameKo: '새롬관',
    roomType: 2,
    genderPolicy: 'BOTH',
    sortOrder: 6,
  },
  {
    id: 'irum',
    campusCode: 'CHUNCHEON',
    nameKo: '이룸관',
    roomType: 2,
    genderPolicy: 'BOTH',
    sortOrder: 7,
  },
  {
    id: 'daon',
    campusCode: 'CHUNCHEON',
    nameKo: '다온관',
    roomType: 2,
    genderPolicy: 'BOTH',
    sortOrder: 8,
  },
];

export const DORMITORY_GUIDE_DATA = {
  toegye: {
    bathroomType: 'SHARED',
    facilities: ['매점(CU)', '체력단련실', '탁구장', 'PC방', '세탁실', '택배보관소'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  dasan: {
    bathroomType: 'SHARED',
    facilities: ['매점(CU)', '체력단련실', '탁구장', 'PC방', '세탁실', '택배보관소'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  yeji: {
    bathroomType: 'SHARED',
    facilities: ['휴게실', '독서실', '컴퓨터실', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  nanji: {
    bathroomType: 'SHARED',
    facilities: ['휴게실(PC포함)', '독서실', '체력단련실', '세미나룸', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  gukji: {
    bathroomType: 'SHARED',
    facilities: ['휴게실(PC포함)', '독서실', '체력단련실', '세미나룸', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  saerom: {
    bathroomType: 'PRIVATE',
    facilities: ['휴게실', '체력단련실', '택배보관실', '독서실', '컴퓨터실', '세탁실', '매점'],
    repairContact: '033-251-2278',
    diningContact: '070-8228-3412',
  },
  irum: {
    bathroomType: 'PRIVATE',
    facilities: ['휴게실', '체력단련실', '택배보관실', '독서실', '컴퓨터실', '세탁실', '매점'],
    repairContact: '033-250-8035',
    diningContact: '070-7124-4632',
  },
  daon: {
    bathroomType: 'PRIVATE',
    facilities: ['이룸관과 동급 BTL 시설 예상'],
    repairContact: '확인 중',
    diningContact: null,
  },
};
