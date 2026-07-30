import { PanelsTopLeft } from 'lucide-react';
import { LoginSeasonContextPreview } from './LoginSeasonContextPreview';

export function LoginProductPreviewPanel() {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
        <PanelsTopLeft className="size-4" aria-hidden="true" />
        서비스 이용 흐름
      </p>
      <h2
        id="login-preview-title"
        className="mt-4 keep-all text-2xl font-bold leading-tight text-(--knu-text-primary)"
      >
        시즌부터 매칭까지
      </h2>
      <p className="mt-2 keep-all text-sm leading-6 text-(--knu-text-secondary)">
        로그인 전, 간단히 이용 흐름을 확인해요.
      </p>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
        <LoginSeasonContextPreview />
      </div>
    </div>
  );
}
