'use client';

/**
 * Security Message Card Component
 * Displays security promise with lock icon
 */

import { Lock } from 'lucide-react';

export function SecurityMessageCard() {
  return (
    <div className="px-4 py-4 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm">
      <div className="flex gap-3">
        <Lock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
        <div>
          <p className="text-sm text-cyan-300/90 leading-relaxed">
            You own your keys. We never see your seed phrase.
          </p>
        </div>
      </div>
    </div>
  );
}
