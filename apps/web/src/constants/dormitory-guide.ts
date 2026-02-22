export interface DormitoryGuideInfo {
  bathroomType: '공동 화장실/세면실' | '호실 내 화장실/샤워실';
  facilities: string[];
  repairContact: string;
  diningContact: string | null;
}

export const DORMITORY_GUIDE: Record<string, DormitoryGuideInfo> = {
  toegye: {
    bathroomType: '공동 화장실/세면실',
    facilities: ['매점(CU)', '체력단련실', '탁구장', 'PC방', '세탁실', '택배보관소'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  dasan: {
    bathroomType: '공동 화장실/세면실',
    facilities: ['매점(CU)', '체력단련실', '탁구장', 'PC방', '세탁실', '택배보관소'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  yeji: {
    bathroomType: '공동 화장실/세면실',
    facilities: ['휴게실', '독서실', '컴퓨터실', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  nanji: {
    bathroomType: '공동 화장실/세면실',
    facilities: ['휴게실(PC포함)', '독서실', '체력단련실', '세미나룸', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  gukji: {
    bathroomType: '공동 화장실/세면실',
    facilities: ['휴게실(PC포함)', '독서실', '체력단련실', '세미나룸', '세탁실'],
    repairContact: '033-250-8063',
    diningContact: null,
  },
  saerom: {
    bathroomType: '호실 내 화장실/샤워실',
    facilities: ['휴게실', '체력단련실', '택배보관실', '독서실', '컴퓨터실', '세탁실', '매점'],
    repairContact: '033-251-2278',
    diningContact: '070-8228-3412',
  },
  irum: {
    bathroomType: '호실 내 화장실/샤워실',
    facilities: ['휴게실', '체력단련실', '택배보관실', '독서실', '컴퓨터실', '세탁실', '매점'],
    repairContact: '033-250-8035',
    diningContact: '070-7124-4632',
  },
  daon: {
    bathroomType: '호실 내 화장실/샤워실',
    facilities: ['이룸관과 동급 BTL 시설 예상'],
    repairContact: '확인 중',
    diningContact: null,
  },
};

export const COMMON_RULES = [
  { emoji: '🕐', label: '통금', value: '01:00 ~ 05:00' },
  { emoji: '🚭', label: '실내 흡연', value: '즉시 퇴사 (전자담배 포함)' },
  { emoji: '🍺', label: '음주', value: '주류 반입/음주 시 퇴사 (빈병 포함)' },
  { emoji: '🔥', label: '실내 조리', value: '불·열기구 사용 금지 (배달/간편식은 OK)' },
  { emoji: '🚫', label: '금지물품', value: '냉장고, 전기포트, 전기장판, 선풍기 등' },
];

export const EMERGENCY_CONTACTS = [
  { label: '야간·공휴일 콜센터', value: '033-250-8067' },
  { label: '관생 일반문의 (주간)', value: '033-250-8073' },
  { label: '수납/환불 문의', value: '033-250-8052' },
];

export const DORM_HOMEPAGE_URL = 'https://knudorm.kangwon.ac.kr/index.knu';
