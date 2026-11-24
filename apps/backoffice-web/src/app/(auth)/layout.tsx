import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-narrow flex-col justify-center px-6 py-12">
      <div className="rounded-card border border-stroke-subtle bg-layer-default p-8">
        {children}
      </div>
    </main>
  );
}
