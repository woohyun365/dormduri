import { MainTabHeaderFrame } from '@/main/components/layout/MainTabHeaderFrame';
import { PairMatchingIdentityHeader } from '../components/pair/PairMatchingIdentityHeader';
import type { MatchingShellHeroView } from '../model/matching-shell-presentation';
import type { MatchingViewerHeader } from '../model/matching-viewer-header';

const defaultHero: MatchingShellHeroView = {
  tone: 'neutral',
  eyebrow: '매칭 현황',
  statusLabel: '상태 확인',
  title: '매칭 현황',
  description: '요청과 확정 결과는 서버에서 확인한 최신 상태를 기준으로 안내해요.',
};

export function MatchingTabHeader({
  hero = defaultHero,
  viewer,
  deadlineLabel = null,
  showSeasonResidence = true,
  onNavigateProfile,
  sticky = true,
}: {
  readonly hero?: MatchingShellHeroView;
  readonly viewer?: MatchingViewerHeader;
  readonly deadlineLabel?: string | null;
  readonly showSeasonResidence?: boolean;
  readonly onNavigateProfile?: () => void;
  readonly sticky?: boolean;
}) {
  return (
    <MainTabHeaderFrame tone="primary" width="home" sticky={sticky}>
      <PairMatchingIdentityHeader
        hero={hero}
        viewer={viewer}
        deadlineLabel={deadlineLabel}
        showSeasonResidence={showSeasonResidence}
        onNavigateProfile={onNavigateProfile}
      />
    </MainTabHeaderFrame>
  );
}
