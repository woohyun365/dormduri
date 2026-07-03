export function OperationsPanelSkeleton() {
  return (
    <div className="space-y-3" aria-label="운영 센터 로딩 중">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-2xl border border-(--knu-border) bg-(--knu-background-alt)"
        />
      ))}
    </div>
  );
}
