// Basic UI Progress component
import React from 'react';

interface ProgressProps {
  value?: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ 
  value = 0, 
  className = '' 
}) => {
  return (
    <div className={`relative h-4 w-full overflow-hidden rounded-full bg-secondary bg-gray-200 ${className}`}>
      <div
        className="h-full w-full flex-1 bg-primary transition-all bg-blue-600"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  );
};
