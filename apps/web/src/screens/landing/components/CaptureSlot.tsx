// Gray body for a window or phone frame until a capture of the main screen exists; the size names the
// capture, framed like the main screen it stands for.
export function CaptureSlot({
  label,
  size,
  className = '',
}: {
  label: string;
  size: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-1 bg-placeholder-fill p-4 text-center text-fg-placeholder ${className}`}
    >
      <p className="text-body-sm font-bold break-keep">{label}</p>
      <p className="text-label">{size}</p>
    </div>
  );
}
