import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import HomeTab from '../HomeTab';
import NoticesPageClient from '@/notices/NoticesPageClient';
import NotificationsPageClient from '@/notifications/NotificationsPageClient';
import SupportPageClient from '@/support/SupportPageClient';
import { homeStoryScenarios } from './home-story-scenarios';
import { useHomeStoryApiFixtures } from './home-story-api-fixtures';

type StoryRoute =
  | { kind: 'home'; label: string }
  | { kind: 'notices'; label: string; noticeId?: string }
  | { kind: 'notifications'; label: string }
  | { kind: 'support'; label: string; ticketId?: string };

interface OperationsPageFlowProps {
  initialRoute: StoryRoute;
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

function OperationsPageFlow({ initialRoute }: OperationsPageFlowProps) {
  const [route, setRoute] = useState<StoryRoute>(initialRoute);

  useHomeStoryApiFixtures({
    operationsMode: 'loaded',
    profileMode: 'default',
  });

  useEffect(() => {
    setRoute(initialRoute);
  }, [initialRoute]);

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
          dashboard={homeStoryScenarios.operationsLoaded.dashboard}
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
  title: 'Main/HomeTab/Operations Pages',
  component: OperationsPageFlow,
  parameters: {
    docs: {
      description: {
        component:
          'HomeTab의 공지사항/알림함/문의하기 preview entry가 전용 SPA page(/notices, /notifications, /support)로 이어지는 흐름을 확인하는 story입니다. Storybook 안에서는 실제 route 이동 대신 story-local route state로 page를 전환합니다.',
      },
    },
  },
  argTypes: {
    initialRoute: {
      table: { disable: true },
    },
  },
} satisfies Meta<typeof OperationsPageFlow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HomeEntryFlow: Story = {
  name: 'HomeTab entry → dedicated pages',
  args: { initialRoute: { kind: 'home', label: 'HomeTab' } },
  parameters: {
    docs: {
      description: {
        story:
          'HomeTab에서 공지 배너, 알림함, 문의하기/문의 내역 CTA를 클릭하면 각각 /notices, /notifications, /support page surface로 전환되는지 확인합니다.',
      },
    },
  },
};

export const NoticesPage: Story = {
  name: '/notices page',
  args: { initialRoute: { kind: 'notices', label: '/notices' } },
};

export const NotificationsPage: Story = {
  name: '/notifications page',
  args: { initialRoute: { kind: 'notifications', label: '/notifications' } },
};

export const SupportPage: Story = {
  name: '/support page',
  args: { initialRoute: { kind: 'support', label: '/support' } },
};
