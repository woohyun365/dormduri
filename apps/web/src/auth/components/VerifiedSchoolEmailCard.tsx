import { CheckCircle2 } from 'lucide-react';

interface VerifiedSchoolEmailCardProps {
  email: string;
}

export function VerifiedSchoolEmailCard({ email }: VerifiedSchoolEmailCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-indigo-100">
        <CheckCircle2 className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-indigo-600">인증된 학교 이메일</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{email}</p>
      </div>
    </div>
  );
}
