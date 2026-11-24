export function Forbidden() {
  return (
    <p role="alert" className="rounded-box bg-layer-muted px-4 py-3 text-body text-fg-label">
      이 화면을 볼 권한이 없습니다. 필요한 역할은 권한 요청으로 받습니다.
    </p>
  );
}
