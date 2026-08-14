import type { ReactNode } from 'react';
import { Building, GraduationCap, IdCard, MapPin, User } from 'lucide-react';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import {
  formatCampusName,
  formatCollegeName,
  formatGradeLabel,
  formatKoreanAgeLabel,
} from '@/main/model/profileDisplayCopy';
import { ProfileIntroBlock } from './ProfileIntroBlock';
import type { PublicProfileFullDetail } from '@repo/shared/profile/contract';

export function ProfileHeroSection({
  profile,
  dormitoryLabel,
}: {
  readonly profile: PublicProfileFullDetail;
  readonly dormitoryLabel?: string | null;
}) {
  const academicIdentity = [
    formatCollegeName(profile.additional.college, '단과대 비공개'),
    formatGradeLabel(profile.additional.grade, '학년 비공개'),
  ].join(' · ');
  const mbti = profile.additional.mbti ?? '-';
  const avatarColor = getAvatarColor(profile.nickname);
  const dormitory = dormitoryLabel?.trim() || '-';

  return (
    <section className="overflow-hidden rounded-4xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm backdrop-blur lg:p-6">
      <div className="mb-4">
        <p className="text-xs font-bold text-blue-700">상대 프로필</p>
        <h3 className="mt-1 text-base font-bold text-(--knu-text-primary)">프로필 기본 정보</h3>
      </div>

      <div className="space-y-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur lg:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor.bg} ${avatarColor.text}`}
              aria-hidden="true"
            >
              {profile.nickname.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-600">닉네임</p>
              <h2 className="mt-1 block max-w-full truncate whitespace-nowrap text-xl font-black tracking-tight text-(--knu-text-primary) sm:text-2xl lg:text-[1.7rem]">
                {profile.nickname}
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <HeroInfoPill
              icon={<MapPin className="h-4 w-4" />}
              iconClassName="text-sky-500"
              label="캠퍼스"
              value={formatCampusName(profile.campus)}
            />
            <HeroInfoPill
              icon={<Building className="h-4 w-4" />}
              iconClassName="text-indigo-500"
              label="기숙사"
              value={dormitory}
            />
            <HeroInfoPill
              icon={<User className="h-4 w-4" />}
              iconClassName="text-orange-500"
              label="나이"
              value={formatKoreanAgeLabel(profile.additional.birthYear)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <HeroSummaryBlock
            icon={<GraduationCap className="h-4 w-4" />}
            iconClassName="text-emerald-500"
            title="단과대 / 학년"
            value={academicIdentity}
          />
          <HeroSummaryBlock
            icon={<IdCard className="h-4 w-4" />}
            iconClassName="text-violet-500"
            title="MBTI"
            value={mbti}
          />
        </div>

        <ProfileIntroBlock intro={profile.intro} />
      </div>
    </section>
  );
}

function HeroInfoPill({
  icon,
  iconClassName,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly iconClassName: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm backdrop-blur">
      <span className={iconClassName} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-(--knu-text-tertiary)">{label}</p>
        <p className="truncate text-sm font-bold text-(--knu-text-primary)">{value}</p>
      </div>
    </div>
  );
}

function HeroSummaryBlock({
  icon,
  iconClassName,
  title,
  value,
}: {
  readonly icon: ReactNode;
  readonly iconClassName: string;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-slate-600">
        <span className={iconClassName} aria-hidden="true">
          {icon}
        </span>
        <p className="text-xs font-bold">{title}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-(--knu-text-primary)">{value}</p>
    </div>
  );
}
