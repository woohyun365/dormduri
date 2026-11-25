import { describe, expect, it } from 'vitest';
import type { BackofficePermission } from '@repo/shared/backoffice';
import { currentItem, locate, NAVIGATION, visibleNavigation } from './navigation';

// The console menu groups (design guide ③): today's five items in work groups, hidden by permission as before.

const EVERY: readonly BackofficePermission[] = [
  'admin:account:invite',
  'admin:account:deactivate',
  'admin:access:request',
  'admin:access:approve',
  'admin:audit:read',
  'admin:audit:review',
];

function shape(groups: ReturnType<typeof visibleNavigation>) {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => [item.label, item.href]),
  }));
}

describe('console navigation (design guide ③)', () => {
  it("groups the menu as 홈 · 운영자 관리 · 감사 · 내 설정 with today's labels and paths", () => {
    expect(shape(visibleNavigation(EVERY))).toEqual([
      { label: null, items: [['홈', '/']] },
      {
        label: '운영자 관리',
        items: [
          ['운영자 계정', '/accounts'],
          ['권한 요청', '/access'],
        ],
      },
      { label: '감사', items: [['감사 기록', '/audit']] },
      { label: '내 설정', items: [['내 보안 설정', '/security']] },
    ]);
    expect(NAVIGATION.flatMap((group) => group.items)).toHaveLength(5);
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
