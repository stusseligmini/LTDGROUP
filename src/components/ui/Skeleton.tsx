'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Preset skeleton components
export function SkeletonCard() {
  return (
    <div className="space-y-3">
      <Skeleton variant="rectangular" height={24} width="60%" />
      <Skeleton variant="rectangular" height={16} width="80%" />
      <Skeleton variant="rectangular" height={16} width="40%" />
    </div>
  );
}

export function SkeletonBalance() {
  return (
    <div className="space-y-4">
      <Skeleton variant="rectangular" height={48} width="100%" className="max-w-xs mx-auto" />
      <Skeleton variant="rectangular" height={24} width="60%" className="max-w-xs mx-auto" />
    </div>
  );
}

export function SkeletonTransaction() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" height={16} width="70%" />
        <Skeleton variant="text" height={12} width="50%" />
      </div>
      <Skeleton variant="text" height={16} width={80} />
    </div>
  );
}

