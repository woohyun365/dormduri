import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import HomeTab from '../HomeTab';
import NoticesPageClient from '@/notices/NoticesPageClient';
import NotificationsPageClient from '@/notifications/NotificationsPageClient';
import SupportPageClient from '@/support/SupportPageClient';
import type { HomeStoryOperationsMode } from './home-story-api-fixtures';
import { homeStoryScenarios } from './home-story-scenarios';
import { useHomeStoryApiFixtures } from './home-story-api-fixtures';

type StoryRoute =
  | { kind: 'home'; label: string }
  | { kind: 'notices'; label: string; noticeId?: string }
  | { kind: 'notifications'; label: string }
  | { kind: 'support'; label: string; ticketId?: string };

interface OperationsPageFlowProps {
  initialRoute: StoryRoute;
  operationsMode: HomeStoryOperationsMode;
}

function resolveStoryRouteFromHref(href: string): StoryRoute | null {
  const url = new URL(href, window.location.origin);
  if (url.pathname === '/main') return { kind: 'home', label: 'HomeTab' };
  if (url.pathname === '/notices') return { kind: 'notices', label: '/notices' };
  if (url.pathname.startsWith('/notices/')) {
    return {
      kind: 'notices',
      label: url.pathname,
      noticeId: decodeURIComponent(url.pathname.split('/').at(-1) ?? ''),
    };
  }
  if (url.pathname === '/notifications') {
    return { kind: 'notifications', label: '/notifications' };
  }
  if (url.pathname === '/support') {
    const ticketId = url.searchParams.get('ticketId') ?? undefined;
    return {
      kind: 'support',
      label: ticketId ? `/support?ticketId=${ticketId}` : '/support',
      ticketId,
    };
  }
  return null;
}

function OperationsPageFlow({ initialRoute, operationsMode }: OperationsPageFlowProps) {
  return (
    <OperationsPageFlowState
      key={initialRoute.label}
      initialRoute={initialRoute}
      operationsMode={operationsMode}
    />
  );
}

function OperationsPageFlowState({ initialRoute, operationsMode }: OperationsPageFlowProps) {
  const [route, setRoute] = useState<StoryRoute>(initialRoute);

  useHomeStoryApiFixtures({
    operationsMode,
    profileMode: 'default',
  });

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const nextRoute = resolveStoryRouteFromHref(anchor.href);
      if (!nextRoute) return;

      event.preventDefault();
      setRoute(nextRoute);
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, []);

  return (
    <div className="min-h-screen bg-(--knu-background-alt)">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-2 text-xs font-bold text-slate-600 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span>Story route: {route.label}</span>
          {route.kind !== 'home' && (
            <button
              type="button"
              onClick={() => setRoute({ kind: 'home', label: 'HomeTab' })}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-white"
            >
              HomeTab으로 돌아가기
            </button>
          )}
        </div>
      </div>

      {route.kind === 'home' && (
        <HomeTab
          dashboard={homeStoryScenarios.seasonOpenRegisteredPreview.dashboard}
          onNavigate={() => undefined}
          onOpenBuildingSelect={() => undefined}
          onDashboardRefresh={async () => undefined}
          onDeregisterSeasonParticipation={async () => undefined}
        />
      )}
      {route.kind === 'notices' && <NoticesPageClient initialNoticeId={route.noticeId} />}
      {route.kind === 'notifications' && <NotificationsPageClient />}
      {route.kind === 'support' && <SupportPageClient initialTicketIdOverride={route.ticketId} />}
    </div>
  );
}

const meta = {
  title: 'Main/HomeTab/Operations/Pages',
  component: OperationsPageFlow,
  parameters: {
    docs: {
      description: {
        component:
          'HomeTab의 공지사항/알림함/문의하기 entry가 전용 SPA page(/notices, /notifications, /support)로 이어지는 흐름을 확인하는 story입니다. Storybook 안에서는 실제 route 이동 대신 story-local route state로 page를 전환합니다.',
      },
    },
  },
  argTypes: {
    initialRoute: { table: { disable: true } },
    operationsMode: { table: { disable: true } },
  },
} satisfies Meta<typeof OperationsPageFlow>;

export default meta;

type Story = StoryObj<typeof meta>;

function createOperationsPageStory(
  name: string,
  initialRoute: StoryRoute,
  operationsMode: HomeStoryOperationsMode,
  description: string,
): Story {
  return {
    name,
    args: { initialRoute, operationsMode },
    parameters: {
      docs: {
        description: { story: description },
      },
    },
  };
}

export const HomeEntryFlow = createOperationsPageStory(
  'HomeTab entry → dedicated pages',
  { kind: 'home', label: 'HomeTab' },
  'loaded',
  'HomeTab은 공지사항/알림함/문의하기 route entry와 unread count만 보여주고, 목록/상세/error 상태는 전용 page가 담당합니다.',
);

export const NoticesWithOneNotice = createOperationsPageStory(
  'Notices / one notice',
  { kind: 'notices', label: '/notices' },
  'loaded',
  '공지사항 page에서 공개 공지 1개와 상세 article을 확인합니다.',
);

export const NoticesEmpty = createOperationsPageStory(
  'Notices / empty',
  { kind: 'notices', label: '/notices' },
  'notices-empty',
  '공개된 공지사항이 없을 때 전용 page empty state를 확인합니다.',
);

export const NoticesError = createOperationsPageStory(
  'Notices / error',
  { kind: 'notices', label: '/notices' },
  'notices-error',
  '공지사항 fetch 실패는 HomeTab이 아니라 /notices page error state에서 처리합니다.',
);

export const NotificationsSupportReplied = createOperationsPageStory(
  'Notifications / support reply',
  { kind: 'notifications', label: '/notifications' },
  'notifications-support-replied',
  '문의 답변 알림이 문의하기 handoff와 함께 표시되는지 확인합니다.',
);

export const NotificationsMatchRequestReceived = createOperationsPageStory(
  'Notifications / match request received',
  { kind: 'notifications', label: '/notifications' },
  'notifications-match-request-received',
  '새롭게 받은 매칭 요청 알림이 매칭 탭 확인 안내로 표시되는지 확인합니다.',
);

export const NotificationsMatchRequestAccepted = createOperationsPageStory(
  'Notifications / sent request accepted',
  { kind: 'notifications', label: '/notifications' },
  'notifications-match-request-accepted',
  '보낸 매칭 요청이 수락되어 매칭이 확정된 알림 copy를 확인합니다.',
);

export const NotificationsMatchRequestRejected = createOperationsPageStory(
  'Notifications / sent request rejected',
  { kind: 'notifications', label: '/notifications' },
  'notifications-match-request-rejected',
  '보낸 매칭 요청이 거절된 상태를 사용자에게 중립적으로 안내하는지 확인합니다.',
);

export const NotificationsActiveMatchCreated = createOperationsPageStory(
  'Notifications / active match created',
  { kind: 'notifications', label: '/notifications' },
  'notifications-active-match-created',
  '매칭 성공 알림이 매칭 결과 확인 안내로 표시되는지 확인합니다.',
);

export const NotificationsReportStatusUpdated = createOperationsPageStory(
  'Notifications / report status updated',
  { kind: 'notifications', label: '/notifications' },
  'notifications-report-status-updated',
  '신고 처리 상태 변경 알림이 민감한 신고 원문 없이 표시되는지 확인합니다.',
);

export const NotificationsEnforcementNotice = createOperationsPageStory(
  'Notifications / enforcement notice',
  { kind: 'notifications', label: '/notifications' },
  'notifications-enforcement-notice',
  '피신고인 제재 고지가 신고자/증거 원문 없이 coarse category와 이의 경로만 표시되는지 확인합니다.',
);

export const NotificationsSeasonSystemNotice = createOperationsPageStory(
  'Notifications / season notice',
  { kind: 'notifications', label: '/notifications' },
  'notifications-season-system-notice',
  '시즌 운영 안내 알림이 공지사항과 분리된 개인 알림으로 표시되는지 확인합니다.',
);

export const NotificationsChatThreadCreated = createOperationsPageStory(
  'Notifications / chat thread created',
  { kind: 'notifications', label: '/notifications' },
  'notifications-chat-thread-created',
  '새 대화 시작 알림이 대화 탭 확인 안내로 표시되는지 확인합니다.',
);

export const NotificationsEmpty = createOperationsPageStory(
  'Notifications / empty',
  { kind: 'notifications', label: '/notifications' },
  'notifications-empty',
  '알림이 없을 때 알림함 전용 empty state를 확인합니다.',
);

export const NotificationsError = createOperationsPageStory(
  'Notifications / error',
  { kind: 'notifications', label: '/notifications' },
  'notifications-error',
  '알림함 fetch 실패는 HomeTab이 아니라 /notifications page error state에서 처리합니다.',
);

export const SupportWithTicket = createOperationsPageStory(
  'Support / ticket thread',
  { kind: 'support', label: '/support', ticketId: 'story-support-ticket-1' },
  'loaded',
  '문의하기 page에서 FAQ, 내 문의 목록, 선택된 ticket thread를 확인합니다.',
);

export const SupportReportListHandoff = createOperationsPageStory(
  'Support / report success handoff',
  { kind: 'support', label: '/support' },
  'support-report-list',
  '신고 접수 receipt 이후 Support page에서 내 신고 내역을 확인하고 신고 처리 이의 신청으로 이어지는 상태입니다.',
);

export const SupportReportListWithAppealThread = createOperationsPageStory(
  'Support / report list + appeal thread',
  { kind: 'support', label: '/support', ticketId: 'story-support-report-ticket-1' },
  'support-report-list',
  '신고 접수 후 Support page에서 내 신고 내역과 연결된 신고 처리 이의 thread를 확인합니다.',
);

export const SupportEnforcementNoticeListHandoff = createOperationsPageStory(
  'Support / enforcement notice handoff',
  { kind: 'support', label: '/support' },
  'support-enforcement-list',
  '제재 고지 이후 Support page에서 내 이용 제한 내역과 이의 신청 CTA를 확인합니다.',
);

export const SupportEnforcementNoticeWithAppealThread = createOperationsPageStory(
  'Support / enforcement notice + appeal thread',
  { kind: 'support', label: '/support', ticketId: 'story-support-enforcement-ticket-1' },
  'support-enforcement-list',
  '이용 제한 내역과 연결된 제재/임시 제한 이의 thread를 확인합니다.',
);

export const SupportEmpty = createOperationsPageStory(
  'Support / empty',
  { kind: 'support', label: '/support' },
  'support-empty',
  'FAQ와 문의 내역이 비어 있을 때 고객센터 page empty state를 확인합니다.',
);

export const SupportError = createOperationsPageStory(
  'Support / error',
  { kind: 'support', label: '/support' },
  'support-error',
  '문의하기 fetch 실패는 HomeTab이 아니라 /support page error state에서 처리합니다.',
);
