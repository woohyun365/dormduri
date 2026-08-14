import { SeasonOpenActivitySection } from './SeasonOpenActivitySection';
import type { TabId, MatchingNavOptions } from '@/main/model/navigation';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

interface SeasonMatchingPreparationActivitySectionProps {
  viewModel: HomeDashboardViewModel;
  onNavigate: (tab: TabId, options?: MatchingNavOptions) => void;
  onDeregisterSeasonParticipation?: () => Promise<void>;
}

export function SeasonMatchingPreparationActivitySection(
  props: SeasonMatchingPreparationActivitySectionProps,
) {
  return <SeasonOpenActivitySection {...props} />;
}
