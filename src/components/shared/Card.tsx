import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const paddings = { sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div className={`bg-white rounded-lg border border-card-border shadow-sm ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
}
