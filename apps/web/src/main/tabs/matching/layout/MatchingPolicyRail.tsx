export function MatchingPolicyRail() {
  return (
    <div className="rounded-3xl border border-(--knu-border) bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-(--knu-text-primary)">매칭 이용 안내</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-(--knu-text-secondary)">
        <li>가능한 작업과 제한 사유는 서버의 현재 정책을 따라요.</li>
        <li>상태가 바뀌면 로컬에서 추측하지 않고 최신 정보를 다시 확인해요.</li>
        <li>현재 학생 대상 서비스는 2인 매칭만 지원해요.</li>
      </ul>
    </div>
  );
}
