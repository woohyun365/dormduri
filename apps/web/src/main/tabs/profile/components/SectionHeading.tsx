interface SectionHeadingProps {
  icon?: React.ReactNode;
  title: string;
  suffix?: React.ReactNode;
  variant?: 'default' | 'danger';
}

export function SectionHeading({ icon, title, suffix, variant = 'default' }: SectionHeadingProps) {
  return (
    <h2
      className={`font-bold mb-3 flex items-center gap-2 ${
        variant === 'danger' ? 'text-red-600' : 'text-(--knu-text-primary)'
      }`}
    >
      {icon}
      {title}
      {suffix && <span className="text-xs font-normal text-(--knu-text-tertiary)">{suffix}</span>}
    </h2>
  );
}
