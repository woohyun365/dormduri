interface SectionProps {
  children: React.ReactNode;
  className?: string;
  background?: 'white' | 'alt';
  containerSize?: 'default' | 'narrow' | 'wide';
  id?: string;
}

export function Section({
  children,
  className = '',
  background = 'white',
  containerSize = 'default',
  id,
}: SectionProps) {
  const bgStyles = {
    white: 'bg-white',
    alt: 'bg-[var(--knu-background-alt)]',
  } as const;

  const containerStyles = {
    default: 'max-w-7xl',
    narrow: 'max-w-4xl',
    wide: 'max-w-screen-2xl',
  } as const;

  return (
    <section
      id={id}
      className={`${bgStyles[background]} ${className} ${id ? 'scroll-mt-16 lg:scroll-mt-20' : ''}`}
    >
      <div className={`mx-auto ${containerStyles[containerSize]} px-5 lg:px-8`}>{children}</div>
    </section>
  );
}
