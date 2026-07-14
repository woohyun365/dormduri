export function MatchingTabHeader() {
  return (
    <header className="rounded-3xl border border-(--knu-border) bg-white px-5 py-5 shadow-sm sm:px-6">
      <p className="text-sm font-semibold text-(--knu-primary)">현재 시즌</p>
      <h1
        id="matching-tab-heading"
        tabIndex={-1}
        className="mt-1 text-2xl font-bold tracking-tight text-(--knu-text-primary)"
      >
        매칭 현황
      </h1>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">
        요청과 확정 결과는 서버에서 확인한 최신 상태를 기준으로 안내해요.
      </p>
    </header>
  );
}
