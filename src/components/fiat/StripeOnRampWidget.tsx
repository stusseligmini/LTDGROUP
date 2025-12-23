/**
 * Stripe Crypto On-Ramp Widget
 * Embeddable component for buying crypto with credit card
 * NO CUSTODY - crypto goes directly to user's wallet
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { appFetch } from '@/lib/network/appFetch';

interface StripeOnRampWidgetProps {
  walletAddress: string;
  destinationNetwork?: string;
  destinationCurrency?: string;
  sourceAmount?: string;
  sourceCurrency?: string;
  onSuccess?: (sessionId: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function StripeOnRampWidget({
  walletAddress,
  destinationNetwork = 'solana',
  destinationCurrency = 'sol',
  sourceAmount,
  sourceCurrency = 'usd',
  onSuccess,
  onError,
  onClose,
}: StripeOnRampWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let stripeOnrampElement: any;

    async function initializeStripe() {
      try {
        setLoading(true);
        setError(null);

        // 1. Create session server-side
          const response = await appFetch('/api/stripe/create-onramp-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            destinationNetwork,
            destinationCurrency,
            sourceAmount,
            sourceCurrency,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create session');
        }

        const { clientSecret } = await response.json();

        // 2. Load Stripe.js
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        // Load Stripe script
        if (!(window as any).Stripe) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Stripe.js'));
            document.head.appendChild(script);
          });
        }

        if (!mounted) return;

        // 3. Initialize Stripe Crypto On-Ramp
        const stripe = (window as any).Stripe(publishableKey);
        const stripeOnramp = stripe.cryptoOnrampSessionManagement({
          clientSecret,
        });

        // 4. Mount element
        if (containerRef.current) {
          stripeOnrampElement = stripeOnramp.createEmbedded({
            appearance: {
              theme: 'dark',
            },
          });

          stripeOnrampElement.mount(containerRef.current);
        }

        // 5. Listen for completion
        stripeOnramp.addEventListener('onramp_session_updated', (event: any) => {
          const session = event.session;
          
          if (session.status === 'fulfillment_complete') {
            onSuccess?.(session.id);
          } else if (session.status === 'rejected' || session.status === 'expired') {
            onError?.(new Error(`Session ${session.status}`));
          }
        });

        setLoading(false);
      } catch (err) {
        console.error('[Stripe On-Ramp] Initialization failed:', err);
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Stripe';
          setError(errorMsg);
          onError?.(new Error(errorMsg));
          setLoading(false);
        }
      }
    }

    initializeStripe();

    return () => {
      mounted = false;
      if (stripeOnrampElement) {
        stripeOnrampElement.unmount();
      }
    };
  }, [walletAddress, destinationNetwork, destinationCurrency, sourceAmount, sourceCurrency, onSuccess, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Stripe...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
        <div className="text-center text-red-400">
          <p className="mb-4">❌ {error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[600px] rounded-lg overflow-hidden" />
  );
}
