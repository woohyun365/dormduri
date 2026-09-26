import { useEffect, useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seasonParticipationApi } from '@/main/api/season-participation.api';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { MainRuntime } from './MainRuntime';
import { useMainHomeResource, useMainShell } from './MainContexts';
import HomeRoute from '@/main/routes/HomeRoute';
import ProfileRoute from '@/main/routes/ProfileRoute';
import RoommatesRoute from '@/main/routes/RoommatesRoute';
import ChatRoute from '@/main/routes/ChatRoute';
import MatchingRoute from '@/main/routes/MatchingRoute';

const navigation = vi.hoisted(() => ({
  pathname: '/main',
  search: '',
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock('@/main/tabs/home/HomeTab', () => ({
  default: (props: {
    onDashboardRefresh: () => void;
    onDeregisterSeasonParticipation: () => Promise<void>;
    onNavigate: (tab: string, selection: object) => void;
  }) => (
    <>
      <h1>Home</h1>
      <button onClick={props.onDashboardRefresh}>refresh</button>
      <button onClick={() => void props.onDeregisterSeasonParticipation().catch(() => undefined)}>
        deregister
      </button>
      <button
        onClick={() => props.onNavigate('matching', { section: 'current', requestTab: 'received' })}
      >
        requests
      </button>
    </>
  ),
}));
vi.mock('@/main/tabs/profile/ProfileTab', () => ({
  default: function Profile(props: {
    user: { intro: string };
    onIntroChange: (intro: string) => void;
    onDormitoryChange: (id: string | null) => void;
  }) {
    const [draft, setDraft] = useState('');
    return (
      <>
        <h1>Profile</h1>
        <output data-testid="saved">{props.user.intro}</output>
        <input
          aria-label="profile draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button onClick={() => props.onIntroChange(draft)}>apply</button>
        <button onClick={() => props.onDormitoryChange(null)}>clear dormitory</button>
      </>
    );
  },
}));
vi.mock('@/main/tabs/roommate-list/RoommateListTab', () => ({
  default: function Roommates(props: {
    user: { dormitoryId: string | null };
    viewerSeasonRegistered: boolean;
  }) {
    const [filter, setFilter] = useState('');
    return (
      <>
        <h1>Roommates</h1>
        <output data-testid="dormitory">{String(props.user.dormitoryId)}</output>
        <output data-testid="registered">{String(props.viewerSeasonRegistered)}</output>
        <input aria-label="filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </>
    );
  },
}));
vi.mock('@/main/tabs/chat/ChatTab', () => ({
  default: function Chat() {
    const [draft, setDraft] = useState('');
    return (
      <>
        <h1>Chat</h1>
        <input aria-label="chat draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </>
    );
  },
}));
vi.mock('@/main/tabs/matching/MatchingTab', () => ({
  default: (props: {
    onBadgeCountChange: (count: number) => void;
    routeSelection: object;
    onRouteSelectionChange: (selection: object) => void;
  }) => (
    <>
      <h1>Matching</h1>
      <output data-testid="selection">{JSON.stringify(props.routeSelection)}</output>
      <button onClick={() => props.onBadgeCountChange(7)}>publish badge</button>
      <button onClick={() => props.onRouteSelectionChange({ section: 'past', requestTab: 'sent' })}>
        past sent
      </button>
    </>
  ),
}));

function RefreshProbe() {
  const resource = useMainHomeResource();
  const shell = useMainShell();
  return (
    <>
      <button onClick={resource.refetch}>shell refresh</button>
      <output data-testid="projection">{Object.keys(shell.viewer).sort().join(',')}</output>
    </>
  );
}
const entries = {
  '/main': <HomeRoute />,
  '/main/profile': <ProfileRoute />,
  '/main/roommates': <RoommatesRoute />,
  '/main/chat': <ChatRoute />,
  '/main/matching': <MatchingRoute />,
};
const base = () => createHomeDashboardTestResponse();
function tree(
  viewer = base().viewer.identity.user.id,
  dashboard = base(),
  dashboardUnavailable = false,
) {
  const seeded = structuredClone(dashboard);
  seeded.viewer.identity.user.id = viewer;
  return (
    <MainRuntime
      key={viewer}
      viewerId={viewer}
      initialDashboard={seeded}
      dashboardUnavailable={dashboardUnavailable}
    >
      <RefreshProbe />
      {entries[navigation.pathname as keyof typeof entries]}
    </MainRuntime>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  navigation.pathname = '/main';
  navigation.search = '';
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.refresh.mockReset();
});

describe('destination runtime lifetimes', () => {
  it('focuses named destination content only on pathname change, not initial load, query or refresh', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    try {
      const view = render(tree());
      await screen.findByRole('heading', { name: 'Home' });
      expect(outside).toHaveFocus();
      navigation.pathname = '/main/chat';
      view.rerender(tree());
      expect(screen.getByRole('main', { name: '채팅 주요 내용' })).toHaveFocus();
      const draft = screen.getByLabelText('chat draft');
      draft.focus();
      navigation.search = 'campaign=keep';
      view.rerender(tree());
      expect(draft).toHaveFocus();
      fireEvent.click(screen.getByText('shell refresh'));
      await act(async () => undefined);
      expect(draft).toHaveFocus();
      navigation.pathname = '/main/profile';
      view.rerender(tree());
      expect(screen.getByRole('main', { name: '내 프로필 주요 내용' })).toHaveFocus();
    } finally {
      outside.remove();
    }
  });

  it('preserves a destination feature that already focused its own content', async () => {
    function FocusOwner() {
      const heading = useRef<HTMLHeadingElement>(null);
      useEffect(() => {
        heading.current?.focus();
      }, []);
      return (
        <h1 ref={heading} tabIndex={-1}>
          Feature-owned focus
        </h1>
      );
    }
    const view = render(tree());
    await screen.findByRole('heading', { name: 'Home' });
    navigation.pathname = '/main/matching';
    view.rerender(
      <MainRuntime
        key="user-1"
        viewerId="user-1"
        initialDashboard={{
          ...base(),
          viewer: {
            ...base().viewer,
            identity: {
              ...base().viewer.identity,
              user: { ...base().viewer.identity.user, id: 'user-1' },
            },
          },
        }}
        dashboardUnavailable={false}
      >
        <FocusOwner />
      </MainRuntime>,
    );
    expect(screen.getByRole('heading', { name: 'Feature-owned focus' })).toHaveFocus();
  });

  it('five routes share one dashboard request; Links own URL and Home actions carry Matching intent', async () => {
    const view = render(tree());
    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.getByTestId('projection').textContent).toBe(
      'campus,dormitory,dormitoryId,gender,id,nickname',
    );
    fireEvent.click(screen.getByText('requests'));
    expect(navigation.push).toHaveBeenCalledWith(
      '/main/matching?section=current&requestTab=received',
    );
    for (const [pathname, heading] of [
      ['/main/roommates', 'Roommates'],
      ['/main/matching', 'Matching'],
      ['/main/chat', 'Chat'],
      ['/main/profile', 'Profile'],
    ]) {
      navigation.pathname = pathname!;
      view.rerender(tree());
      await screen.findByRole('heading', { name: heading });
      expect(document.querySelector('nav a[aria-current="page"]')).toHaveAttribute(
        'href',
        pathname,
      );
    }
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('Profile applied state and explicit null overlay survive non-Home routes, not draft or Home reset', async () => {
    const dashboard = base();
    navigation.pathname = '/main/profile';
    const view = render(tree());
    await screen.findByRole('heading', { name: 'Profile' });
    fireEvent.change(screen.getByLabelText('profile draft'), { target: { value: 'applied' } });
    fireEvent.click(screen.getByText('apply'));
    fireEvent.click(screen.getByText('clear dormitory'));
    fireEvent.change(screen.getByLabelText('profile draft'), { target: { value: 'not applied' } });
    navigation.pathname = '/main/roommates';
    await act(async () => view.rerender(tree()));
    expect(screen.getByTestId('dormitory')).toHaveTextContent('null');
    expect(screen.getByTestId('registered')).toHaveTextContent(
      String(dashboard.viewer.seasonProfile.registered),
    );
    navigation.pathname = '/main/profile';
    view.rerender(tree());
    expect(screen.getByTestId('saved')).toHaveTextContent('applied');
    expect(screen.getByLabelText('profile draft')).toHaveValue('');
    navigation.pathname = '/main';
    view.rerender(tree());
    navigation.pathname = '/main/profile';
    view.rerender(tree());
    expect(screen.getByTestId('saved')).toBeEmptyDOMElement();
  });

  it('badge is Matching-published only, persists non-Home and clears on Home/season', async () => {
    const dashboard = base();
    const next = structuredClone(dashboard);
    next.season.state = 'OFF_SEASON';
    navigation.pathname = '/main/matching';
    const view = render(tree());
    await screen.findByRole('heading', { name: 'Matching' });
    fireEvent.click(screen.getByText('publish badge'));
    navigation.pathname = '/main/chat';
    view.rerender(tree());
    expect(screen.getByRole('link', { name: /매칭 현황/ })).toHaveTextContent('7');
    fireEvent.click(screen.getByText('shell refresh'));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    view.rerender(tree(dashboard.viewer.identity.user.id, next));
    expect(screen.getByRole('link', { name: /매칭 현황/ })).not.toHaveTextContent('7');
    navigation.pathname = '/main/matching';
    view.rerender(tree());
    fireEvent.click(screen.getByText('publish badge'));
    navigation.pathname = '/main';
    view.rerender(tree());
    navigation.pathname = '/main/chat';
    view.rerender(tree());
    expect(screen.getByRole('link', { name: /매칭 현황/ })).not.toHaveTextContent('7');
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it('season change clears Profile and Roommate state but keeps Chat draft; leaving Chat clears it', async () => {
    const dashboard = base();
    const next = structuredClone(dashboard);
    next.season.state = 'OFF_SEASON';
    navigation.pathname = '/main/profile';
    const view = render(tree());
    await screen.findByLabelText('profile draft');
    fireEvent.change(screen.getByLabelText('profile draft'), {
      target: { value: 'private profile' },
    });
    fireEvent.click(screen.getByText('apply'));
    navigation.pathname = '/main/chat';
    view.rerender(tree());
    fireEvent.change(screen.getByLabelText('chat draft'), {
      target: { value: 'keep conversation' },
    });
    fireEvent.click(screen.getByText('shell refresh'));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    view.rerender(tree(dashboard.viewer.identity.user.id, next));
    await act(async () => undefined);
    expect(screen.getByLabelText('chat draft')).toHaveValue('keep conversation');
    navigation.pathname = '/main/profile';
    view.rerender(tree());
    expect(screen.getByTestId('saved')).toBeEmptyDOMElement();
    navigation.pathname = '/main/chat';
    view.rerender(tree());
    expect(screen.getByLabelText('chat draft')).toHaveValue('');
    navigation.pathname = '/main/roommates';
    view.rerender(tree());
    fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'old filter' } });
    view.rerender(tree(dashboard.viewer.identity.user.id, dashboard));
    expect(screen.getByLabelText('filter')).toHaveValue('old filter');
    navigation.pathname = '/main/chat';
    view.rerender(tree(dashboard.viewer.identity.user.id, dashboard));
    navigation.pathname = '/main/roommates';
    view.rerender(tree(dashboard.viewer.identity.user.id, dashboard));
    expect(screen.getByLabelText('filter')).toHaveValue('');
  });

  it('viewer change removes private draft without waiting for a browser dashboard response', async () => {
    navigation.pathname = '/main/chat';
    const view = render(tree());
    fireEvent.change(await screen.findByLabelText('chat draft'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('shell refresh'));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    view.rerender(tree('other'));
    expect(screen.queryByDisplayValue('secret')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('chat draft')).toHaveValue('');
  });

  it('invalid owned query is replaced, explicit query follows history without dashboard reload', async () => {
    navigation.pathname = '/main/matching';
    navigation.search = 'section=bad&requestTab=sent&campaign=keep';
    const view = render(tree());
    await screen.findByTestId('selection');
    expect(navigation.replace).toHaveBeenCalledWith(
      '/main/matching?campaign=keep&requestTab=sent',
      { scroll: false },
    );
    navigation.search = 'section=past&requestTab=received';
    view.rerender(tree());
    expect(screen.getByTestId('selection')).toHaveTextContent('"section":"past"');
    navigation.search = 'section=current&requestTab=sent';
    view.rerender(tree());
    expect(screen.getByTestId('selection')).toHaveTextContent('"section":"current"');
    fireEvent.click(screen.getByText('past sent'));
    expect(navigation.push).toHaveBeenCalledWith('/main/matching?section=past&requestTab=sent', {
      scroll: false,
    });
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it('disabled Matching has visible reason and no navigating link, including direct URL', async () => {
    const dashboard = base();
    dashboard.viewer.campusOperated = false;
    navigation.pathname = '/main/matching';
    render(tree(dashboard.viewer.identity.user.id, dashboard));
    await screen.findByText('캠퍼스 운영 준비 중이에요.');
    expect(screen.queryByRole('link', { name: /매칭 현황/ })).not.toBeInTheDocument();
    const disabled = screen.getByRole('button', { name: /매칭 현황/ });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(disabled);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('successful deregistration refreshes once; failed mutation does not refresh', async () => {
    const deregister = vi
      .spyOn(seasonParticipationApi, 'deregisterCurrentSeasonParticipation')
      .mockResolvedValue(undefined as never);
    const view = render(tree());
    await screen.findByText('deregister');
    fireEvent.click(screen.getByText('deregister'));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(deregister).toHaveBeenCalledTimes(1);
    view.unmount();
    render(tree());
    deregister.mockRejectedValueOnce(new Error('failed'));
    fireEvent.click(screen.getByText('deregister'));
    await waitFor(() => expect(deregister).toHaveBeenCalledTimes(2));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });
});
