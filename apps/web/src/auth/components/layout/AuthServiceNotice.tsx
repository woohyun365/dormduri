import Link from 'next/link';

interface AuthServiceNoticeProps {
  className?: string;
  copyVariant?: 'responsive' | 'compact' | 'full';
  showDetailsLink?: boolean;
}

export function AuthServiceNotice({
  className = '',
  copyVariant = 'responsive',
  showDetailsLink = true,
}: AuthServiceNoticeProps) {
  const fullCopy = '본 서비스는 강원대학교 공식 서비스가 아닌 독립 운영 서비스입니다.';

  return (
    <p
      className={`${
        copyVariant === 'full' ? 'keep-all whitespace-normal' : 'whitespace-nowrap'
      } text-xs leading-5 text-(--knu-text-tertiary) ${className}`.trim()}
    >
      {copyVariant === 'compact' ? (
        <span>강원대학교 비공식 독립 운영 서비스예요.</span>
      ) : copyVariant === 'full' ? (
        <span>{fullCopy}</span>
      ) : (
        <>
          <span className="sm:hidden">강원대학교 비공식 독립 운영 서비스예요.</span>
          <span className="hidden sm:inline">{fullCopy}</span>
        </>
      )}
      {showDetailsLink && (
        <>
          {' '}
          <Link
            href="/terms"
            className="inline-block whitespace-nowrap font-medium underline underline-offset-2 sm:inline sm:whitespace-normal"
          >
            자세히 보기
          </Link>
        </>
      )}
    </p>
  );
}
