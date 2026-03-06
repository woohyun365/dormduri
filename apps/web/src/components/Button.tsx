interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles =
    'font-semibold transition-all rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary:
      'bg-[var(--knu-primary)] hover:bg-[var(--knu-primary-hover)] text-white shadow-sm hover:shadow-md',
    secondary:
      'bg-[var(--knu-secondary)] hover:bg-[var(--knu-secondary-hover)] text-white shadow-sm',
    outline:
      'border-2 border-[var(--knu-border)] hover:border-[var(--knu-primary)] hover:bg-[var(--knu-primary-light)] text-[var(--knu-text-primary)] transition-all disabled:border-gray-200 disabled:text-gray-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md',
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
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? '...' : children}
    </button>
  );
}
