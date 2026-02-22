export function SkeletonCard() {
  return (
    <div className="p-4 bg-white rounded-2xl border-2 border-[var(--knu-border)] animate-pulse">
      {/* Header: avatar + nickname + badge + match score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div>
            <div className="h-4 bg-gray-200 rounded-lg w-16 mb-1.5" />
            <div className="h-3 bg-gray-200 rounded-lg w-24" />
          </div>
        </div>
        <div className="h-7 bg-gray-200 rounded-full w-16" />
      </div>

      {/* Chips */}
      <div className="flex gap-2 mb-3">
        <div className="h-6 bg-gray-200 rounded-full w-14" />
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="h-6 bg-gray-200 rounded-full w-18" />
      </div>

      {/* Intro line */}
      <div className="h-4 bg-gray-200 rounded-lg w-full mb-3" />

      {/* Button */}
      <div className="flex justify-end">
        <div className="h-9 bg-gray-200 rounded-xl w-24" />
      </div>
    </div>
  );
}
