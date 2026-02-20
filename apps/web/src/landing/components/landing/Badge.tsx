interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-[var(--knu-primary-light)] text-[var(--knu-primary)]',
    secondary: 'bg-blue-50 text-blue-700',
  } as const;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
