import { AuthCard } from '@/ui/AuthCard';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { TextLink } from '@/ui/TextLink';

/** A missing page, outside the console in the sign-in card (design guide ④). */
export function NotFoundScreen() {
  return (
    <AuthCard>
      <h1 className="text-title-1 font-bold text-fg-neutral">없는 화면입니다</h1>
      <TextLink href="/" className="inline-flex items-center gap-1 self-start text-body">
        홈으로
        <Icon name="arrow" className="size-4" />
      </TextLink>
    </AuthCard>
  );
}

/** A page the API could not give, with the retry of the error boundary (app/error.tsx). */
export function ErrorScreen({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <AuthCard>
      <div className="flex flex-col gap-3">
        <h1 className="text-title-1 font-bold text-fg-neutral">화면을 불러오지 못했습니다</h1>
        <p className="text-body text-fg-description">
          백오피스 API에 닿지 못했거나 응답을 읽지 못했습니다. 포트 포워딩이 열려 있는지 확인하고
          다시 시도하세요.
        </p>
      </div>
      <Button className="self-start" onClick={onRetry}>
        다시 시도
      </Button>
    </AuthCard>
  );
}
