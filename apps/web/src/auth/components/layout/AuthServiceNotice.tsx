import Link from 'next/link';

interface AuthServiceNoticeProps {
  className?: string;
}

export function AuthServiceNotice({ className = '' }: AuthServiceNoticeProps) {
  return (
    <p
      className={`whitespace-nowrap text-xs leading-5 text-(--knu-text-tertiary) ${className}`.trim()}
    >
      <span className="sm:hidden">강원대학교 비공식 독립 운영 서비스예요.</span>
      <span className="hidden sm:inline">
        본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.
      </span>{' '}
      <Link
        href="/terms"
        className="inline-block whitespace-nowrap font-medium underline underline-offset-2 sm:inline sm:whitespace-normal"
      >
        자세히 보기
      </Link>
    </p>
  );
}
