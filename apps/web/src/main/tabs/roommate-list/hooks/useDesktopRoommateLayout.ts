import { useEffect, useState } from 'react';

const DESKTOP_ROOMMATE_LAYOUT_QUERY = '(min-width: 1024px)';

export function useDesktopRoommateLayout(): boolean {
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_ROOMMATE_LAYOUT_QUERY);
    const updateLayout = () => setIsDesktopLayout(mediaQuery.matches);

    updateLayout();
    mediaQuery.addEventListener('change', updateLayout);
    return () => mediaQuery.removeEventListener('change', updateLayout);
  }, []);

  return isDesktopLayout;
}
