"use client";
import React from 'react';

export default function WalletConnectDisabled() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
      <h2 className="text-xl font-semibold text-amber-800 mb-2">WalletConnect Temporarily Disabled</h2>
      <p className="text-sm text-amber-700 leading-relaxed">
        The WalletConnect integration has been removed from this build to resolve bundling issues
        caused by transitive test dependencies (<code>thread-stream</code>, <code>tap</code>, <code>tape</code>, <code>why-is-node-running</code>). No pairing
        or session functionality is currently active.
      </p>
      <p className="text-xs text-amber-600 mt-4">
        Reintroduction will use an updated, lighter SDK (e.g. Reown WalletKit) behind a feature flag
        and stricter session approval UX. Track progress in the project ROADMAP.
      </p>
    </div>
  );
}
