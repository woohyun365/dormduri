interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const baseStyles =
    'font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary:
      'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white shadow-sm hover:shadow-md',
    secondary:
      'bg-[var(--knu-secondary)] hover:bg-[var(--knu-secondary-hover)] text-white shadow-sm',
    outline:
      'border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] hover:bg-[var(--knu-primary-light)] text-[var(--knu-text-primary)] transition-all',
  };

  const sizeStyles = {
    sm: 'h-11 px-5 text-sm',
    md: 'h-12 px-6 text-base',
    lg: 'h-14 px-8 text-lg',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
