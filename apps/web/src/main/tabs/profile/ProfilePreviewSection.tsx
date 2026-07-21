import { Eye } from 'lucide-react';
import { SectionHeading } from '@/main/tabs/profile/components/SectionHeading';
import { LifestyleChipSummary } from '../../components/LifestyleChipSummary';
import type { UserProfile } from '@/types/profile';
import type { DormitoryDisplayItem } from '@/main/model/dormitoryDisplay.adapter';

interface ProfilePreviewSectionProps {
  user: UserProfile;
  dormitory: DormitoryDisplayItem | null;
  avatarColor: { bg: string; text: string };
  onShowDetail: () => void;
}

export function ProfilePreviewSection({
  user,
  dormitory,
  avatarColor,
  onShowDetail,
}: ProfilePreviewSectionProps) {
  return (
    <section>
      <SectionHeading
        icon={<Eye className="w-5 h-5 text-(--knu-primary)" />}
        title="다른 사람에게 보이는 내 카드"
      />
      <button type="button" onClick={onShowDetail} className="cursor-pointer w-full text-left">
        <div className="bg-white rounded-2xl border-2 border-(--knu-border) p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 ${avatarColor.bg} rounded-full flex items-center justify-center text-sm font-bold ${avatarColor.text}`}
              >
                {user.nickname.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-sm text-(--knu-text-primary)">{user.nickname}</h3>
                {dormitory && (
                  <p className="text-xs text-(--knu-text-tertiary)">
                    {dormitory.name} {dormitory.roomType}인실
                  </p>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-green-600 bg-green-100">
              매칭 100%
            </span>
          </div>
          <div className="mb-3">
            <LifestyleChipSummary lifestyle={user.lifestyle} />
          </div>
          <p className="text-sm text-(--knu-text-secondary) leading-relaxed line-clamp-1 mb-3">
            {user.intro}
          </p>
        </div>
      </button>
    </section>
  );
}
