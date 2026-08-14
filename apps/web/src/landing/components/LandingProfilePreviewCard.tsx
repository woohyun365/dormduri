import {
  ProfileSummaryFactList,
  ProfileSummaryIdentity,
  ProfileSummaryIntroPanel,
  ProfileSummaryScoreBadge,
} from '@/profile-summary/components';
import { buildProfileSummaryFacts } from '@/profile-summary/model/profileSummaryFacts';
import type { LandingProfilePreviewItem } from '../content/landing-profile-preview.examples';

interface LandingProfilePreviewCardProps {
  profile: LandingProfilePreviewItem;
}

export function LandingProfilePreviewCard({ profile }: LandingProfilePreviewCardProps) {
  const { nickname, intro } = profile.profileSummary;
  const facts = buildProfileSummaryFacts(profile.profileSummary);

  return (
    <article className="rounded-2xl border border-(--knu-border) bg-white p-3 shadow-md sm:p-4">
      <div className="mb-3">
        <ProfileSummaryIdentity
          nickname={nickname}
          metadataLabel={profile.displayDormitoryLabel}
          avatarClassName={profile.avatarClassName}
          trailing={
            <ProfileSummaryScoreBadge
              score={profile.matchScore}
              label={`매칭점수 ${profile.matchScore}점`}
            />
          }
        />
      </div>

      <ProfileSummaryFactList ownerId={profile.id} facts={facts} className="mb-3" />

      <div>
        <ProfileSummaryIntroPanel intro={intro} />
      </div>
    </article>
  );
}
