"use client";

import React from 'react';

type Variant = 'default' | 'destructive' | 'success' | 'warning';

export function Alert({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: Variant }) {
  const variantClass = variant === 'destructive'
    ? 'border-red-600 bg-red-50 text-red-800'
    : variant === 'success'
    ? 'border-green-600 bg-green-50 text-green-800'
    : variant === 'warning'
    ? 'border-yellow-600 bg-yellow-50 text-yellow-800'
    : 'border-slate-700 bg-slate-800 text-slate-200';

  return (
    <div className={`rounded-md border p-4 ${variantClass} ${className || ''}`} role="alert">
      {children}
    </div>
  );
}

export function AlertDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm ${className || ''}`}>{children}</div>;
}
