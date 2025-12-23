"use client";
import React, { useState } from 'react';
import { auth } from '@/lib/firebase/client';

// Placeholder: Firebase WebAuthn passkey enrollment/sign-in when enabled via auth settings.
// For now this just shows a button.
export function PasskeyButton() {
  const [status, setStatus] = useState<string|undefined>();

  async function handlePasskey() {
    setStatus('Passkey flow placeholder');
    // TODO: integrate Firebase passkey API once enabled
  }

  return (
    <div className="space-y-2">
      <button onClick={handlePasskey} className="w-full border rounded py-2">Use Passkey</button>
      {status && <div className="text-xs text-gray-600">{status}</div>}
    </div>
  );
}
