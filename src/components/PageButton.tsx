import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageButtonProps {
  onClick: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  className?: string;
  'aria-label'?: string;
  /** Optional short label used only on mobile to keep the button compact. */
  mobileLabel?: string;
  disabled?: boolean;
}

export const PageButton = ({
  onClick,
  children,
  variant = 'primary',
  icon: Icon,
  className = '',
  'aria-label': ariaLabel,
  mobileLabel,
  disabled = false,
}: PageButtonProps) => {
  const baseClasses = `inline-flex items-center justify-center px-3 sm:px-4 py-2.5 border text-xs sm:text-sm font-light tracking-tight rounded-md focus:outline-none transition-opacity whitespace-nowrap ${
    disabled
      ? 'opacity-50 cursor-not-allowed'
      : 'hover:opacity-80'
  }`;

  const variantClasses = {
    primary: 'border-primary-600 dark:border-primary-500 text-white bg-primary-600 dark:bg-primary-500',
    secondary: 'border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900',
    danger: 'border-red-500 dark:border-red-500 text-white bg-red-500 dark:bg-red-500',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} w-full sm:w-auto ${className}`}
      aria-label={ariaLabel}
    >
      {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" aria-hidden="true" />}
      <span className="hidden sm:inline whitespace-nowrap">{children}</span>
      <span className="sm:hidden whitespace-nowrap">
        {mobileLabel ?? (typeof children === 'string' ? children : children)}
      </span>
    </button>
  );
};

