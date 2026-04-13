import * as React from 'react';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', ...props }, ref) => {
    return <label ref={ref} className={`text-sm font-medium text-slate-700 ${className}`.trim()} {...props} />;
  }
);

Label.displayName = 'Label';
