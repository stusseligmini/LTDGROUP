"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function DevToolsWarning() {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  useEffect(() => {
    const checkDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      const isOpen = widthThreshold || heightThreshold;
      
      setIsDevToolsOpen(isOpen);
    };

    checkDevTools();
    const interval = setInterval(checkDevTools, 1000);
    window.addEventListener('resize', checkDevTools);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', checkDevTools);
    };
  }, []);

  // Suppress the banner in development to avoid noisy local UX
  if (process.env.NODE_ENV === 'development' || !isDevToolsOpen) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-3 z-50 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg">
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <span className="text-center">
         WARNING: Developer tools detected! Never paste code or share your seed phrase!
      </span>
    </div>
  );
}
