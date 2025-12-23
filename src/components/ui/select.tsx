// Basic UI Select component
import React, { useState, useRef, useEffect } from 'react';

export const Select: React.FC<{
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  value?: string;
  children: React.ReactNode;
}> = ({ onValueChange, defaultValue, value, children }) => {
  const [internalValue, setInternalValue] = useState(value || defaultValue || '');
  const [isOpen, setIsOpen] = useState(false);
  
  const currentValue = value !== undefined ? value : internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            value: currentValue,
            onValueChange: handleValueChange,
            isOpen,
            setIsOpen
          });
        }
        return child;
      })}
    </div>
  );
};

export const SelectTrigger: React.FC<{
  className?: string;
  children: React.ReactNode;
  value?: string;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}> = ({ className = '', children, isOpen, setIsOpen }) => {
  return (
    <button
      type="button"
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-gray-200 bg-white ${className}`}
      onClick={() => setIsOpen?.(!isOpen)}
    >
      {children}
      <svg
        className={`h-4 w-4 opacity-50 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

export const SelectValue: React.FC<{
  placeholder?: string;
  value?: string;
}> = ({ placeholder, value }) => {
  return (
    <span className={value ? '' : 'text-gray-400'}>
      {value || placeholder}
    </span>
  );
};

export const SelectContent: React.FC<{
  className?: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onValueChange?: (value: string) => void;
}> = ({ className = '', children, isOpen, onValueChange }) => {
  if (!isOpen) return null;
  
  return (
    <div className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 bg-white border-gray-200 shadow-lg mt-1 w-full ${className}`}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            onValueChange
          });
        }
        return child;
      })}
    </div>
  );
};

export const SelectItem: React.FC<{
  value: string;
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}> = ({ value, className = '', children, onValueChange }) => {
  return (
    <div
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-gray-100 cursor-pointer ${className}`}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  );
};
