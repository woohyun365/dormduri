interface StepHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function StepHeader({ icon, title, description }: StepHeaderProps) {
  return (
    <div className="text-center mb-8">
      <div className="w-16 h-16 bg-[var(--knu-primary-light)] rounded-2xl flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-[var(--knu-text-primary)] mb-2">
        {title}
      </h2>
      <p className="text-[var(--knu-text-secondary)]">{description}</p>
    </div>
  );
}
