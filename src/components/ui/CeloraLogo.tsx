'use client';

import React from 'react';

interface CeloraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  withText?: boolean;
  className?: string;
  /** Optional custom image source. Defaults to `/celora-lock.png` in public */
  src?: string;
  /** Crop the image into a perfect circle */
  rounded?: boolean;
  /** Optional wordmark image rendered under the lock when provided */
  wordmarkSrc?: string;
  /** Optional extra classes for wordmark cropping/transform */
  wordmarkClassName?: string;
  /** Layout: row (icon + text) or stack (icon above wordmark/text) */
  layout?: 'row' | 'stack';
}

const sizeClasses: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-64 h-64',
};

const textSizeClasses: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: 'text-lg',
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
  hero: 'text-6xl',
};

const wordmarkWidth: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: 'w-20',
  sm: 'w-28',
  md: 'w-40',
  lg: 'w-56',
  xl: 'w-72',
  hero: 'w-[28rem]',
};

// Wordmark visible container heights to crop transparent padding (overflow-hidden)
const wordmarkHeights: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-20',
  hero: 'h-28',
};

// Upward shifts to align lettering within the cropped frame (tune as needed)
const wordmarkShiftUp: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: '-translate-y-1',
  sm: '-translate-y-2',
  md: '-translate-y-3',
  lg: '-translate-y-4',
  xl: '-translate-y-6',
  hero: '-translate-y-40',
};

// Top margins between lock and wordmark per size
const wordmarkTopMargin: Record<NonNullable<CeloraLogoProps['size']>, string> = {
  xs: 'mt-1',
  sm: 'mt-2',
  md: 'mt-3',
  lg: 'mt-4',
  xl: 'mt-5',
  hero: 'mt-0',
};

// Default source now points to existing asset in public/images (Windows explorer hides extensions)
export function CeloraLogo({
  size = 'md',
  withText = false,
  className = '',
  src = '/images/93bd0c27-6490-469d-a1d9-8cde4626aa08.png',
  rounded = false,
  wordmarkSrc,
  wordmarkClassName,
  layout = 'row',
}: CeloraLogoProps) {
  const isStack = layout === 'stack';

  // When layout is 'row' and a wordmarkSrc is provided, render the wordmark to the right
  if (!isStack) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`relative ${sizeClasses[size]} ${rounded ? 'rounded-full overflow-hidden' : ''}`}>
          <img
            src={src}
            alt="Celora Lock"
            className={`w-full h-full ${rounded ? 'object-cover' : 'object-contain'} select-none`}
            draggable={false}
          />
        </div>
        {wordmarkSrc ? (
          <div className={`relative ${wordmarkWidth[size]}`}>
            <img
              src={wordmarkSrc}
              alt="Celora Wordmark"
              className={`w-full h-auto object-contain select-none ${wordmarkClassName || ''}`}
              draggable={false}
            />
          </div>
        ) : (
          withText && (
            <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 tracking-[0.2em] ${textSizeClasses[size]}`}>
              CELORA
            </span>
          )
        )}
      </div>
    );
  }

  // Default stack layout (lock above wordmark/text)
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`relative ${sizeClasses[size]} ${rounded ? 'rounded-full overflow-hidden' : ''}`}>
        <img
          src={src}
          alt="Celora Lock"
          className={`w-full h-full ${rounded ? 'object-cover' : 'object-contain'} select-none`}
          draggable={false}
        />
      </div>
      {wordmarkSrc ? (
        <div className={`relative ${wordmarkWidth[size]} ${wordmarkTopMargin[size]} ${wordmarkHeights[size]} overflow-hidden`}>
          <img
            src={wordmarkSrc}
            alt="Celora Wordmark"
            className={`w-full object-contain object-top select-none transform ${wordmarkShiftUp[size]} ${wordmarkClassName || ''}`}
            draggable={false}
          />
        </div>
      ) : (
        withText && (
          <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 tracking-[0.2em] ${textSizeClasses[size]}`}>
            CELORA
          </span>
        )
      )}
    </div>
  );
}
