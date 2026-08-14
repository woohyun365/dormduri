'use client';

import { useCallback } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVital } from './web-vitals';

export function WebVitalsReporter() {
  useReportWebVitals(
    useCallback((metric) => {
      reportWebVital(metric);
    }, []),
  );

  return null;
}
