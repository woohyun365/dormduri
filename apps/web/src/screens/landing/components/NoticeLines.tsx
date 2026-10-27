import { firstScreenNotices } from '../model/landingNotices';

// The first screen's two notices: 학교 공식 서비스 아님 and 호실 미보장.
export function NoticeLines({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-col gap-1 text-body-sm break-keep ${className}`}>
      {firstScreenNotices.map((notice) => (
        <li key={notice.id}>{notice.copy}</li>
      ))}
    </ul>
  );
}
