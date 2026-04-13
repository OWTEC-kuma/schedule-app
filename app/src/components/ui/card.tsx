import * as React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

export function Card({ className = '', ...props }: DivProps) {
  return <div className={`rounded-lg bg-white text-slate-950 ${className}`.trim()} {...props} />;
}

export function CardHeader({ className = '', ...props }: DivProps) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`.trim()} {...props} />;
}

export function CardTitle({ className = '', ...props }: HeadingProps) {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`.trim()} {...props} />;
}

export function CardContent({ className = '', ...props }: DivProps) {
  return <div className={`p-6 pt-0 ${className}`.trim()} {...props} />;
}
