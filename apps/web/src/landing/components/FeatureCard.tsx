interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'problem' | 'solution';
}

export function FeatureCard({ icon, title, description, variant = 'default' }: FeatureCardProps) {
  const variantStyles = {
    default: 'bg-white border-[var(--knu-border)]',
    problem: 'bg-red-50 border-red-100',
    solution: 'bg-blue-50 border-blue-100',
  } as const;

  return (
    <div
      className={`p-6 lg:p-8 rounded-2xl border-2 ${variantStyles[variant]} transition-all hover:shadow-lg`}
    >
      <div className="w-14 h-14 rounded-xl bg-[var(--knu-primary-light)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-[var(--knu-text-primary)] mb-3">{title}</h3>
      <p className="text-[var(--knu-text-secondary)] leading-relaxed whitespace-pre-line">
        {description}
      </p>
    </div>
  );
}
