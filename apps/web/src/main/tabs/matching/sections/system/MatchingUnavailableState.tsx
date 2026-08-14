export function MatchingUnavailableState({ message }: { readonly message: string }) {
  return (
    <section className="rounded-3xl border border-(--knu-border) bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-(--knu-text-primary)">매칭 현황을 확인할 수 없어요</h2>
      <p className="mt-2 text-sm leading-6 text-(--knu-text-secondary)">{message}</p>
    </section>
  );
}
