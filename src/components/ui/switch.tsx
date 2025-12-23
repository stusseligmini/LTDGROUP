// Basic UI Switch component
import React from 'react';

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked = false,
  onCheckedChange,
  disabled = false,
  id,
  className = ''
}) => {
  return (
    <label className={`inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <input 
        type="checkbox" 
        className="sr-only peer" 
        checked={checked}
        disabled={disabled}
        id={id}
        onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      />
      <div className={`relative w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-cyan-600 peer-disabled:bg-gray-300 peer-disabled:peer-checked:bg-cyan-300 transition-colors`}>
        <span className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-all peer-checked:left-5`}></span>
      </div>
    </label>
  );
};
