import Image from 'next/image';
import Link from 'next/link';
import { getLandingPolicyCopy } from '../content/landing-policy-copy';

export function LandingFooter() {
  return (
    <footer className="bg-(--knu-background-alt) border-t border-(--knu-border)">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/knu_logo.svg"
                alt="KNU 룸메 로고"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-(--knu-text-primary)">KNU 룸메</span>
            </div>
            <p className="text-(--knu-text-secondary) text-sm leading-relaxed">
              강원대학교 춘천캠퍼스 기숙사 룸메이트 탐색 도우미
            </p>
            <p className="text-(--knu-text-tertiary) text-xs mt-1">
              {getLandingPolicyCopy('service_independent_notice').copy}
            </p>
            <p className="text-(--knu-text-tertiary) text-xs mt-1">
              {getLandingPolicyCopy('profile_privacy_warning').copy}
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-(--knu-text-primary) mb-3">서비스</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/terms"
                    className="text-(--knu-text-secondary) hover:text-(--knu-primary) transition-colors"
                  >
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-(--knu-text-secondary) hover:text-(--knu-primary) transition-colors"
                  >
                    개인정보처리방침
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-(--knu-text-primary) mb-3">문의</h4>
              <p className="text-sm text-(--knu-text-secondary)">woohyun365@gmail.com</p>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-(--knu-border)">
          <p className="text-sm text-(--knu-text-tertiary)">
            &copy; 2026 KNU 룸메. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
