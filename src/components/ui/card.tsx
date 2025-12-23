// Modern Celora Card primitives (glass + gradient border)
import React from 'react';

export const Card = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <section className={`glass-panel border-gradient hover-lift ${className}`} {...props}>
    {children}
  </section>
);

export const CardHeader = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <header className={`cel-card__header ${className}`} {...props}>
    {children}
  </header>
);

export const CardTitle = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <h2 className={`cel-title ${className}`} {...props}>
    {children}
  </h2>
);

export const CardDescription = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <p className={`cel-body ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <div className={`cel-card__content ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '', ...props }: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => (
  <footer className={`cel-card__footer ${className}`} {...props}>
    {children}
  </footer>
);
