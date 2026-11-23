import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-slate-900">없는 화면입니다</h1>
      <Link href="/" prefetch={false} className="text-sm underline">
        홈으로
      </Link>
    </main>
  );
}
