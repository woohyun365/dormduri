import { useCallback, useState } from 'react';
import type { DormitoryPublicSummary } from '@repo/shared/dormitory';
import type { UserProfile } from '@/main/model/profile';

interface ProfileStateOptions {
  showToast: (msg: string) => void;
  dormitories: readonly DormitoryPublicSummary[];
}

export function useMainProfileState(initialUser: UserProfile, options: ProfileStateOptions) {
  const { showToast, dormitories } = options;
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [showBuildingSelect, setShowBuildingSelect] = useState(false);

  const handleSelectDormitory = useCallback(
    (dormitoryId: string | null) => {
      const dormitory = dormitories.find((item) => item.id === dormitoryId) ?? null;
      setUser((previous) => ({ ...previous, dormitoryId, dormitory }));
      showToast(dormitory ? `${dormitory.name}(으)로 설정했어요` : '건물 미배정으로 설정했어요');
    },
    [dormitories, showToast],
  );

  const handleIntroChange = useCallback(
    (intro: string) => {
      setUser((previous) => ({ ...previous, intro }));
      showToast('자기소개가 저장되었어요');
    },
    [showToast],
  );

  const handleLifestyleChange = useCallback(
    (lifestyle: UserProfile['lifestyle']) => {
      setUser((previous) => ({ ...previous, lifestyle }));
      showToast('생활패턴이 저장되었어요');
    },
    [showToast],
  );

  const handleAdditionalChange = useCallback((additional: UserProfile['additional']) => {
    setUser((previous) => ({ ...previous, additional }));
  }, []);

  return {
    user,
    showBuildingSelect,
    setShowBuildingSelect,
    handleSelectDormitory,
    handleIntroChange,
    handleLifestyleChange,
    handleAdditionalChange,
  };
}
