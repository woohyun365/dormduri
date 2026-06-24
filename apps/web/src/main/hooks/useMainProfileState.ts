import { useState, useCallback, useEffect, useRef } from 'react';
import { getProfileCompletion } from '@/utils/profileCompletion';
import { getDormitoryById, UNASSIGNED_ID } from '@/constants/dormitory';
import { GUIDE_DELAY } from '@/constants/ui';
import type { UserProfile } from '@/types/profile';

interface ProfileStateOptions {
  showToast: (msg: string) => void;
  hasSeenGuide: (dormitoryId: string) => boolean;
  markGuideSeen: (dormitoryId: string) => void;
}

export function useMainProfileState(initialUser: UserProfile, options: ProfileStateOptions) {
  const { showToast, hasSeenGuide, markGuideSeen } = options;

  const [user, setUser] = useState<UserProfile>(initialUser);
  const [showGuide, setShowGuide] = useState(false);
  const [showBuildingSelect, setShowBuildingSelect] = useState(false);
  const guideTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (guideTimerRef.current) clearTimeout(guideTimerRef.current);
    };
  }, []);

  const handleSelectDormitory = useCallback(
    (dormitoryId: string) => {
      setUser((prev) => ({ ...prev, dormitoryId }));
      if (dormitoryId === UNASSIGNED_ID) {
        showToast('건물 미배정으로 설정했어요');
      } else {
        const dorm = getDormitoryById(dormitoryId);
        showToast(dorm ? `${dorm.name}(으)로 설정했어요` : '건물이 설정되었어요');
      }
      if (dormitoryId === UNASSIGNED_ID && !hasSeenGuide(dormitoryId)) {
        if (guideTimerRef.current) clearTimeout(guideTimerRef.current);
        guideTimerRef.current = setTimeout(() => setShowGuide(true), GUIDE_DELAY);
      }
    },
    [showToast, hasSeenGuide],
  );

  const handleCloseGuide = useCallback(() => {
    setShowGuide(false);
    if (user.dormitoryId) {
      markGuideSeen(user.dormitoryId);
    }
  }, [user.dormitoryId, markGuideSeen]);

  const handleShowGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  // --- Profile 100% completion toast ---
  const hasShownCompletionToast = useRef(false);
  const wasCompleteOnMount = useRef(getProfileCompletion(user).isComplete);

  const checkAndShowCompletionToast = useCallback(
    (updatedUser: UserProfile) => {
      if (hasShownCompletionToast.current) return;
      if (wasCompleteOnMount.current) return;
      const { isComplete } = getProfileCompletion(updatedUser);
      if (isComplete) {
        showToast('프로필이 완성되었어요! \uD83C\uDF89');
        hasShownCompletionToast.current = true;
      }
    },
    [showToast],
  );

  const handleIntroChange = useCallback(
    (intro: string) => {
      setUser((prev) => {
        const next = { ...prev, intro };
        checkAndShowCompletionToast(next);
        return next;
      });
      showToast('자기소개가 저장되었어요');
    },
    [checkAndShowCompletionToast, showToast],
  );

  const handleMessageChange = useCallback(
    (msg: string | null) => {
      setUser((prev) => {
        const next = { ...prev, messageToRoommate: msg };
        checkAndShowCompletionToast(next);
        return next;
      });
      showToast('룸메에게 한마디가 저장되었어요');
    },
    [checkAndShowCompletionToast, showToast],
  );

  const handleLifestyleChange = useCallback(
    (lifestyle: UserProfile['lifestyle']) => {
      setUser((prev) => {
        const next = { ...prev, lifestyle };
        checkAndShowCompletionToast(next);
        return next;
      });
      showToast('생활패턴이 저장되었어요');
    },
    [checkAndShowCompletionToast, showToast],
  );

  const handleAdditionalChange = useCallback(
    (additional: UserProfile['additional']) => {
      setUser((prev) => {
        const next = { ...prev, additional };
        checkAndShowCompletionToast(next);
        return next;
      });
    },
    [checkAndShowCompletionToast],
  );

  return {
    user,
    showGuide,
    showBuildingSelect,
    setShowBuildingSelect,
    handleSelectDormitory,
    handleCloseGuide,
    handleShowGuide,
    handleIntroChange,
    handleMessageChange,
    handleLifestyleChange,
    handleAdditionalChange,
  };
}
