// Small decorative stroke icons drawn inline (no icon package). Every icon is aria-hidden; the text beside it (or an
// sr-only label) carries the name.

const paths = {
  home: 'M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1z',
  accounts:
    'M7.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2.5 16.5c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M13.5 4a2.5 2.5 0 0 1 0 5M15 12.2c1.6.5 2.5 2 2.5 4.3',
  access:
    'M12.5 3.5a4 4 0 0 0-3.8 5.3L3.5 14v2.5H6V15h1.5v-1.5H9l1.2-1.2a4 4 0 1 0 2.3-8.8M13.5 6.5h.01',
  audit:
    'M5.5 3.5h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1M7.5 7.5h5M7.5 10.5h5M7.5 13.5h3',
  security: 'M10 2.8 4 5v4.6c0 3.6 2.5 6.4 6 7.6 3.5-1.2 6-4 6-7.6V5zM7.5 10l1.8 1.8 3.4-3.6',
  logout: 'M8 3.5H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3M12 6.5 15.5 10 12 13.5M15.5 10H8',
  collapse:
    'M4 4.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1M8 4.5v11M13 8l-2 2 2 2',
  expand:
    'M4 4.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1M8 4.5v11M11 8l2 2-2 2',
  menu: 'M3.5 5.5h13M3.5 10h13M3.5 14.5h13',
  close: 'M5 5l10 10M15 5 5 15',
  arrow: 'M4 10h11.5M11 5.5 15.5 10 11 14.5',
  plus: 'M10 4v12M4 10h12',
  ban: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M5.4 5.4l9.2 9.2',
  refresh: 'M15.5 8A6 6 0 0 0 4.6 6.5M4.5 12a6 6 0 0 0 10.9 1.5M4.5 3.5v3h3M15.5 16.5v-3h-3',
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  className = 'size-5',
}: {
  readonly name: IconName;
  readonly className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
