// Basic UI Separator component
import React from 'react';

export const Separator: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}> = ({ orientation = 'horizontal', className = '' }) => {
  const baseClasses = 'shrink-0 bg-border bg-gray-200';
  const orientationClasses = orientation === 'horizontal' 
    ? 'h-[1px] w-full' 
    : 'h-full w-[1px]';
    
  return (
    <div
      className={`${baseClasses} ${orientationClasses} ${className}`}
      role="separator"
      aria-orientation={orientation}
    />
  );
};
