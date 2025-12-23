// Basic UI Label component
import React from 'react';

export const Label: React.FC<
  React.LabelHTMLAttributes<HTMLLabelElement> & {
    className?: string;
  }
> = ({ className = '', children, ...props }) => {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};
