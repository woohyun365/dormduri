import type { TabId } from '@/main/model/navigation';

const MAIN_TAB_DOCUMENT_TITLE_SUFFIX = 'KNU 룸메';

const MAIN_TAB_PAGE_TITLE_BY_ID: Record<TabId, string> = {
  home: '홈',
  list: '룸메 찾기',
  matching: '매칭 현황',
  chat: '채팅',
  profile: '내 프로필',
};

export function getMainTabPageTitle(tab: TabId): string {
  return MAIN_TAB_PAGE_TITLE_BY_ID[tab];
}

export function getMainTabDocumentTitle(tab: TabId): string {
  return `${getMainTabPageTitle(tab)} | ${MAIN_TAB_DOCUMENT_TITLE_SUFFIX}`;
}
