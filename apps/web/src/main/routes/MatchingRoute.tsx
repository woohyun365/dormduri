'use client';

import { Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import MatchingTab from '@/main/tabs/matching/MatchingTab';
import { MatchingTabSkeleton } from '@/main/tabs/matching/layout/MatchingTabSkeleton';
import { useDormitoryCompatibility } from '@/main/tabs/profile/ProfileCompatibility';
import { useMainShell } from '@/main/runtime/MainContexts';
import { formatCampusName } from '@/main/model/profileDisplayCopy';
import {
  parseMatchingRouteQuery,
  serializeMatchingRouteQuery,
} from '@/main/model/matchingRouteQuery';
import type { MatchingNavOptions } from '@/main/model/navigation';

export default function MatchingRoute() {
  return (
    <Suspense fallback={<MatchingTabSkeleton />}>
      <MatchingDestination />
    </Suspense>
  );
}

function MatchingDestination() {
  const shell = useMainShell();
  const viewer = useDormitoryCompatibility(shell.viewer);
  const router = useRouter();
  const search = useSearchParams().toString();
  const { selection, canonicalSearchParams, needsCanonicalization } = parseMatchingRouteQuery(
    new URLSearchParams(search),
  );
  const canonicalSearch = canonicalSearchParams.toString();
  useEffect(() => {
    if (needsCanonicalization)
      router.replace(
        (canonicalSearch ? `/main/matching?${canonicalSearch}` : '/main/matching') as Route,
        { scroll: false },
      );
  }, [canonicalSearch, needsCanonicalization, router]);
  const onSelection = useCallback(
    (next: MatchingNavOptions) => {
      const params = serializeMatchingRouteQuery(new URLSearchParams(search), next).toString();
      if (params !== search)
        router.push((params ? `/main/matching?${params}` : '/main/matching') as Route, {
          scroll: false,
        });
    },
    [router, search],
  );
  if (!shell.campusOperated)
    return (
      <section className="p-6">
        <h1>매칭 현황</h1>
        <p>캠퍼스 운영 준비 중이에요.</p>
      </section>
    );
  return (
    <MatchingTab
      key={shell.scopeKey}
      viewerId={viewer.id}
      viewerHeader={{
        nickname: viewer.nickname,
        gender: viewer.gender,
        campusLabel: formatCampusName(viewer.campus),
        residenceLabel:
          viewer.dormitoryId && viewer.dormitory
            ? `${viewer.dormitory.name} · ${viewer.dormitory.roomType}인실`
            : null,
      }}
      seasonShell={shell.season}
      onBadgeCountChange={shell.publishMatchingBadge}
      onNavigateChat={() => shell.navigate('chat')}
      onNavigationIntent={(intent) => {
        if (intent !== 'history') shell.navigate(intent === 'roommate' ? 'list' : intent);
      }}
      routeSelection={selection}
      routeIntentKey={search}
      onRouteSelectionChange={onSelection}
    />
  );
}
