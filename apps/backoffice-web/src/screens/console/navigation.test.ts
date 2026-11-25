import { describe, expect, it } from 'vitest';
import type { BackofficePermission } from '@repo/shared/backoffice';
import { currentItem, locate, NAVIGATION, visibleNavigation } from './navigation';

// The console menu groups (design guide ③): the items in work groups, hidden by permission. The legal documents group
// shows with either legal permission (the owner role holds both, backoffice-api README §8).

const EVERY: readonly BackofficePermission[] = [
  'admin:account:invite',
  'admin:account:deactivate',
  'admin:access:request',
  'admin:access:approve',
  'admin:audit:read',
  'admin:audit:review',
  'admin:legal:edit',
  'admin:legal:approve',
];

function shape(groups: ReturnType<typeof visibleNavigation>) {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => [item.label, item.href]),
  }));
}

describe('console navigation (design guide ③)', () => {
  it('groups the menu as 홈 · 운영자 관리 · 법적 문서 · 감사 · 내 설정 with their labels and paths', () => {
    expect(shape(visibleNavigation(EVERY))).toEqual([
      { label: null, items: [['홈', '/']] },
      {
        label: '운영자 관리',
        items: [
          ['운영자 계정', '/accounts'],
          ['권한 요청', '/access'],
        ],
      },
      {
        label: '법적 문서',
        items: [
          ['문서 판', '/legal'],
          ['초안', '/legal/drafts'],
          ['게시 요청', '/legal/requests'],
        ],
      },
      { label: '감사', items: [['감사 기록', '/audit']] },
      { label: '내 설정', items: [['내 보안 설정', '/security']] },
    ]);
    expect(NAVIGATION.flatMap((group) => group.items)).toHaveLength(8);
  });

  it('shows the legal documents group with either legal permission and hides it without both', () => {
    const legal = {
      label: '법적 문서',
      items: [
        ['문서 판', '/legal'],
        ['초안', '/legal/drafts'],
        ['게시 요청', '/legal/requests'],
      ],
    };
    expect(shape(visibleNavigation(['admin:legal:edit']))).toContainEqual(legal);
    expect(shape(visibleNavigation(['admin:legal:approve']))).toContainEqual(legal);
    expect(
      visibleNavigation(['admin:audit:read', 'admin:access:request']).map((group) => group.label),
    ).not.toContain('법적 문서');
  });

  it("marks a legal page's menu item for its sub pages, and only on a path segment", () => {
    const groups = visibleNavigation(EVERY);
    const DRAFT = '/legal/drafts/0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(currentItem(groups, '/legal')?.label).toBe('문서 판');
    expect(currentItem(groups, '/legal/versions/privacy-2026-06-22')?.label).toBe('문서 판');
    expect(currentItem(groups, '/legal/drafts?status=EDITING')?.label).toBe('초안');
    expect(currentItem(groups, DRAFT)?.label).toBe('초안');
    expect(currentItem(groups, '/legal/requests?request=x')?.label).toBe('게시 요청');
    expect(currentItem(groups, '/legalese')).toBeNull();
    expect(currentItem(groups, '/accounts/x')?.label).toBe('운영자 계정');
    expect(locate(DRAFT)).toEqual({ group: '법적 문서', page: '초안' });
    expect(locate('/legal/versions/privacy-2026-06-22')).toEqual({
      group: '법적 문서',
      page: '문서 판',
    });
    // The home is only the root, never a prefix of every path.
    expect(locate('/missing')).toBeNull();
  });

  it('hides an item without its permission and drops a group left empty', () => {
    const requester = visibleNavigation(['admin:access:request']);
    expect(shape(requester)).toEqual([
      { label: null, items: [['홈', '/']] },
      { label: '운영자 관리', items: [['권한 요청', '/access']] },
      { label: '내 설정', items: [['내 보안 설정', '/security']] },
    ]);
    expect(requester.flatMap((group) => group.items.map((item) => item.label))).not.toContain(
      '운영자 계정',
    );
    expect(requester.map((group) => group.label)).not.toContain('감사');
    // Either access permission shows the requests; neither hides them.
    expect(shape(visibleNavigation(['admin:access:approve']))[1]).toEqual({
      label: '운영자 관리',
      items: [['권한 요청', '/access']],
    });
    expect(shape(visibleNavigation([]))).toEqual([
      { label: null, items: [['홈', '/']] },
      { label: '내 설정', items: [['내 보안 설정', '/security']] },
    ]);
  });

  it('marks the current item by path', () => {
    const groups = visibleNavigation(EVERY);
    expect(currentItem(groups, '/')?.label).toBe('홈');
    expect(currentItem(groups, '/access')?.label).toBe('권한 요청');
    expect(currentItem(groups, '/access?status=APPROVED')?.label).toBe('권한 요청');
    expect(currentItem(groups, '/security')?.label).toBe('내 보안 설정');
    expect(currentItem(groups, '/missing')).toBeNull();
    // A hidden item is not current, but the top bar still says where the page is.
    const requester = visibleNavigation(['admin:access:request']);
    expect(currentItem(requester, '/audit')).toBeNull();
    expect(locate('/audit')).toEqual({ group: '감사', page: '감사 기록' });
    expect(locate('/')).toEqual({ group: null, page: '홈' });
    expect(locate('/missing')).toBeNull();
  });
});
