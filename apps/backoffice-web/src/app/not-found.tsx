import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-narrow flex-col gap-4 px-6 py-16">
      <h1 className="text-title-2 font-semibold text-fg-neutral">없는 화면입니다</h1>
      <Link href="/" prefetch={false} className="text-body underline">
        홈으로
      </Link>
    </main>
  );
}
