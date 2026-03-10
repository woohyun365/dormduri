import { useState } from 'react';
import { DEFAULT_FILTERS } from '../components/BottomSheet';
import type { SortMode, ViewMode } from '../tabs/RoommateListTab';

export function useMainListViewState() {
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showProfileBanner, setShowProfileBanner] = useState(true);

  return {
    sortMode,
    setSortMode,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    showProfileBanner,
    dismissProfileBanner: () => setShowProfileBanner(false),
  };
}
