'use client';

import { useEffect, useRef } from 'react';

export default function MainDestinationError({ reset }: { reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="p-6" role="alert">
      <h1 ref={heading} tabIndex={-1}>
        화면을 불러오지 못했어요
      </h1>
      <p>잠시 후 다시 시도해주세요.</p>
      <button type="button" onClick={reset}>
        다시 시도
      </button>
    </section>
  );
}
