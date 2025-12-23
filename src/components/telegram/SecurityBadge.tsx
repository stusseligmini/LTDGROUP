'use client';

/**
 * Security Badge Component
 * Displays "100% Non-Custodial" with lock icon and cyan glow
 */

import { Lock } from 'lucide-react';

export function SecurityBadge() {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 border border-cyan-500/30 shadow-lg"
      style={{
        boxShadow: '0 0 20px rgba(0, 245, 212, 0.3), inset 0 0 15px rgba(0, 245, 212, 0.1)'
      }}>
      <Lock className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
      <span className="font-semibold text-cyan-300">100% Non-Custodial</span>
    </div>
  );
}
