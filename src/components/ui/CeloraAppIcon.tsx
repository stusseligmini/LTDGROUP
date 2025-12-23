'use client';

import React from 'react';

interface CeloraAppIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
}

const sizeClasses: Record<NonNullable<CeloraAppIconProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-64 h-64',
};

// Clean, modern Web3-style app icon for CELORA
export function CeloraAppIcon({ size = 'xl', className = '' }: CeloraAppIconProps) {
  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>      
      <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className="w-full h-full rounded-[22%]">
        <defs>
          {/* Background soft gradient with elegant vignette */}
              <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0d1430" />
            <stop offset="50%" stopColor="#0b1128" />
            <stop offset="100%" stopColor="#090d20" />
          </radialGradient>          {/* Subtle outer glow */}
          <filter id="outerGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Main neon gradient for C */}
          <linearGradient id="cNeon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00eaff" />
            <stop offset="50%" stopColor="#7a49ff" />
            <stop offset="100%" stopColor="#a259ff" />
          </linearGradient>

          {/* Soft specular highlight for polished lighting */}
          <linearGradient id="specular" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
          </linearGradient>

          {/* Inner shadow to keep clarity and depth without noise */}
          <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="shadow" />
            <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
            <feBlend in2="SourceGraphic" mode="normal" />
          </filter>
        </defs>

        {/* Rounded icon base with perfectly smooth gradient fill */}
        <rect x="8" y="8" width="240" height="240" rx="52" fill="url(#bgGrad)" filter="url(#outerGlow)" />

        {/* Inner smooth background - eliminates all white artifacts */}
        <circle cx="128" cy="128" r="96" fill="#0a1026" />
        
        {/* Sleek circular frame (very subtle) */}
        <circle cx="128" cy="128" r="96" fill="none" stroke="#0f1838" strokeWidth="8" opacity="0.35" />
        
        {/* Large, bold, smooth C centered — clean neon, glossy, 3D */}
        <g filter="url(#innerShadow)">
          {/* C main stroke */}
          <path
            d="M188 98c-8-22-29-38-60-38-41 0-66 28-66 68s25 68 66 68c31 0 52-16 60-38"
            fill="none"
            stroke="url(#cNeon)"
            strokeWidth="22"
            strokeLinecap="round"
          />
          {/* Polished highlight overlay for premium finish */}
          <path
            d="M180 92c-10-20-30-32-52-32"
            fill="none"
            stroke="url(#specular)"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.35"
          />
        </g>

        {/* Microchip accent: realistic look with metal body, gold pads, beveled edges */}
        {/* Position chip to match reference: lower-left on C junction */}
        <g transform="translate(72,160) rotate(-28)">
          {/* Microchip integrated into the C with a tech bridge across the gap */}
          {/* Bridge connector: subtle curved traces tying chip into the C */}
          <g>
            {/* Curved bridge traces (gold) from ring into chip */}
            <path
              d="M88 154 C 92 162, 98 166, 106 168"
              fill="none"
              stroke="#e9c46a"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M86 160 C 91 168, 97 171, 105 173"
              fill="none"
              stroke="#c9a44a"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Small connector plate overlapping inner edge of C */}
            <rect x="100" y="166" width="10" height="8" rx="1.5" fill="#2f3c46" stroke="#a07c2a" strokeWidth="1" />
          </g>
          <defs>
            <filter id="chipGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="cblur" />
              <feMerge>
                <feMergeNode in="cblur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="chipBody" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3a4a57" />
              <stop offset="50%" stop-color="#2f3c46" />
              <stop offset="100%" stop-color="#22303a" />
            </linearGradient>
            <linearGradient id="chipBevel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
              <stop offset="50%" stop-color="#ffffff" stop-opacity="0.0" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0.25" />
            </linearGradient>
            <linearGradient id="padGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#fdd36a" />
              <stop offset="50%" stop-color="#e9c46a" />
              <stop offset="100%" stop-color="#c9a44a" />
            </linearGradient>
          </defs>
          {/* Chip base */}
          <rect x="0" y="0" width="34" height="24" rx="4" fill="url(#chipBody)" stroke="#1a2430" strokeWidth="1.5" filter="url(#chipGlow)" />
          {/* Bevel highlight */}
          <path d="M2 2 h30" stroke="url(#chipBevel)" strokeWidth="2" opacity="0.6" />
          {/* Die area (gold) */}
          <rect x="9" y="6" width="16" height="12" rx="2" fill="url(#padGold)" stroke="#a07c2a" strokeWidth="1" />
          {/* Pins left/right */}
          <g stroke="url(#padGold)" strokeWidth="2">
            <line x1="-12" y1="5" x2="0" y2="5" />
            <line x1="-12" y1="12" x2="0" y2="12" />
            <line x1="-12" y1="19" x2="0" y2="19" />
            <line x1="34" y1="5" x2="44" y2="5" />
            <line x1="34" y1="12" x2="44" y2="12" />
            <line x1="34" y1="19" x2="44" y2="19" />
          </g>
          {/* Subtle screws or contacts */}
          <circle cx="4" cy="4" r="1.5" fill="#c0c6cc" opacity="0.6" />
          <circle cx="30" cy="20" r="1.5" fill="#c0c6cc" opacity="0.6" />
        </g>

        {/* Dark elegant background glow accents (minimalistic) */}
        <circle cx="128" cy="128" r="78" fill="none" stroke="#0e1634" strokeWidth="12" opacity="0.18" />
        <circle cx="128" cy="128" r="56" fill="none" stroke="#0e1634" strokeWidth="8" opacity="0.12" />
      </svg>
    </div>
  );
}
