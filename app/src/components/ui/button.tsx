import * as React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', type = 'button', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';
    const variants = {
      default: 'bg-slate-900 text-white hover:bg-slate-800',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    };
    return (
      <button
        ref={ref}
        type={type}
        className={`${base} ${variants[variant]} ${className}`.trim()}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
