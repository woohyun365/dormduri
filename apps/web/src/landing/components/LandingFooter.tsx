import Image from 'next/image';
import Link from 'next/link';
import { getLandingPolicyCopy } from '../content/landing-policy-copy';

interface LandingFooterProps {
  externalInquiryEmail: string;
}

export function LandingFooter({ externalInquiryEmail }: LandingFooterProps) {
  return (
    <footer className="border-t border-(--knu-border) bg-(--knu-background-alt)">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 푸터 로고도 랜딩 상태를 초기화하도록 문서 전체를 다시 연다. */}
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--knu-primary)"
            >
              <Image
                src="/knu_logo.svg"
                alt="KNU 룸메 로고"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-(--knu-text-primary)">KNU 룸메</span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-(--knu-text-secondary)">
              강원대학교 춘천캠퍼스 기숙사 룸메이트 탐색 도우미
            </p>
            <p className="mt-1 text-xs leading-relaxed text-(--knu-text-tertiary)">
              {getLandingPolicyCopy('service_independent_notice').copy}
            </p>
          </div>

          <div className="flex flex-col gap-6 min-[480px]:flex-row min-[480px]:gap-10 lg:justify-end">
            <nav aria-label="푸터 법적 안내">
              <p className="text-xs font-semibold tracking-wide text-(--knu-text-tertiary)">
                법적 안내
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm lg:flex-col lg:items-start lg:gap-y-0">
                <li>
                  <Link
                    href="/terms"
                    className="inline-flex min-h-11 items-center text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary) focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) lg:min-h-0 lg:py-1"
                  >
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="inline-flex min-h-11 items-center text-(--knu-text-secondary) transition-colors hover:text-(--knu-primary) focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--knu-primary) lg:min-h-0 lg:py-1"
                  >
                    개인정보처리방침
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <p className="text-xs font-semibold tracking-wide text-(--knu-text-tertiary)">
                서비스 외부 문의
              </p>
              <address className="mt-3 text-sm not-italic text-(--knu-text-secondary)">
                {externalInquiryEmail}
              </address>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-(--knu-border) pt-6">
          <p className="text-sm text-(--knu-text-tertiary)">
            &copy; 2026 KNU 룸메. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
