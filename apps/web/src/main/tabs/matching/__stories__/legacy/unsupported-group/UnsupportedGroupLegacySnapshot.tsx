import { Users } from 'lucide-react';

/**
 * 출시되지 않은 group 흐름의 역사적 스냅샷이다.
 * canonical story/fixture, 제품 runtime, API contract를 참조하지 않는다.
 */
export function UnsupportedGroupLegacySnapshot() {
  return (
    <main
      data-testid="unsupported-group-legacy-snapshot"
      className="mx-auto min-h-screen max-w-md bg-slate-50 p-5"
    >
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-amber-800">
          <Users className="h-5 w-5" aria-hidden="true" />
          <h1 className="font-bold">3인실 그룹 매칭 (미출시)</h1>
        </div>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          이 스냅샷은 과거 UI 비교 자료입니다. 현재 제품과 API는 2인 매칭만 제공하며 이 화면은 제품
          runtime에서 사용되지 않습니다.
        </p>
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
          Baseline / Legacy / UnsupportedGroup
        </div>
      </section>
    </main>
  );
}
