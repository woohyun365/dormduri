'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import HomeTab from '@/main/tabs/home/HomeTab';
import { BuildingSelectModal } from '@/main/components/BuildingSelectModal';
import { HomeDashboardErrorState } from '@/main/tabs/home/layout/HomeDashboardErrorState';
import { seasonParticipationApi } from '@/main/api/season-participation.api';
import { getDormitoryDisplayFromSeasonOperations } from '@/main/model/dormitoryDisplay.adapter';
import { useMainHomeResource, useMainShell } from '@/main/runtime/MainContexts';
import { isMainHomeRefreshCancelled } from '@/main/hooks/useMainHomeDashboard';

export default function HomeRoute() {
  const resource = useMainHomeResource();
  const { navigate, scopeKey } = useMainShell();
  return <HomeContent key={scopeKey} resource={resource} navigate={navigate} />;
}

function HomeContent({
  resource,
  navigate,
}: {
  resource: ReturnType<typeof useMainHomeResource>;
  navigate: ReturnType<typeof useMainShell>['navigate'];
}) {
  const [showBuildingSelect, setShowBuildingSelect] = useState(false);
  const deregistering = useRef(false);
  const dashboard = resource.dashboard;
  const handleDeregister = useCallback(async () => {
    if (deregistering.current) return;
    deregistering.current = true;
    try {
      await seasonParticipationApi.deregisterCurrentSeasonParticipation();
      toast('시즌 참여를 철회했어요.');
      await resource.refetch();
    } catch (error) {
      if (isMainHomeRefreshCancelled(error)) throw error;
      toast('시즌 참여 철회를 완료하지 못했어요. 잠시 후 다시 시도해주세요.');
      throw error;
    } finally {
      deregistering.current = false;
    }
  }, [resource]);
  if (!dashboard) return null;
  const user = dashboard.viewer.identity.user;
  return (
    <>
      {resource.error && (
        <HomeDashboardErrorState
          message={resource.error}
          refreshing={resource.refreshing}
          onRetry={resource.refetch}
        />
      )}
      {dashboard.viewer.campusOperated &&
        (dashboard.season.isOpen || dashboard.season.isMatching) &&
        showBuildingSelect && (
          <BuildingSelectModal
            campus={user.campus}
            gender={user.gender}
            seasonSelectionLocked={dashboard.season.isOpen || dashboard.season.isMatching}
            onSelect={(id) => {
              setShowBuildingSelect(false);
              const dormitory = getDormitoryDisplayFromSeasonOperations(
                id,
                dashboard.season.operatedDormitories,
              );
              // Existing local-only success copy; no persistence is claimed by this migration.
              toast(
                !id
                  ? '건물 미배정으로 설정했어요'
                  : dormitory
                    ? `${dormitory.name}(으)로 설정했어요`
                    : '건물이 설정되었어요',
              );
            }}
            onClose={() => setShowBuildingSelect(false)}
          />
        )}
      <HomeTab
        dashboard={dashboard}
        onNavigate={navigate}
        onOpenBuildingSelect={() => setShowBuildingSelect(true)}
        onDashboardRefresh={resource.refetch}
        onDeregisterSeasonParticipation={handleDeregister}
      />
    </>
  );
}
