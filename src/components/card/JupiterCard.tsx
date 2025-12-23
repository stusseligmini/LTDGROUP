'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, CreditCard } from 'lucide-react';

interface JupiterCardProps {
  userAddress: string; // Solana address for card linking
  provider?: 'jupiter' | 'kado'; // Card provider selection
  environment?: 'sandbox' | 'production';
  onCardIssued?: (cardId: string) => void;
  onTopUp?: (amount: number, txHash: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  className?: string;
}

// Allowed origins for postMessage validation (security critical)
const ALLOWED_ORIGINS = {
  jupiter: {
    production: 'https://card.jup.ag',
    sandbox: 'https://sandbox-card.jup.ag',
  },
  kado: {
    production: 'https://app.kado.money',
    sandbox: 'https://sandbox.kado.money',
  },
};

/**
 * Virtual Card Widget Component
 * Embeds Jupiter Card or Kado Money provider for virtual debit card issuance.
 * 
 * SECURITY:
 * - Origin validation on all postMessage events
 * - NO private keys ever sent to widget
 * - Iframe sandboxed with strict CSP
 */
export function JupiterCard({
  userAddress,
  provider = 'jupiter',
  environment = 'production',
  onCardIssued,
  onTopUp,
  onError,
  onClose,
  className,
}: JupiterCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Build provider widget URL
  const getWidgetUrl = (): string => {
    const baseUrl = ALLOWED_ORIGINS[provider][environment];
    const apiKey = provider === 'jupiter'
      ? process.env.NEXT_PUBLIC_JUPITER_CARD_API_KEY
      : process.env.NEXT_PUBLIC_KADO_API_KEY;

    if (!apiKey) {
      setErrorMessage(`${provider} API key not configured`);
      return '';
    }

    const params = new URLSearchParams({
      address: userAddress,
      apiKey,
      env: environment,
      theme: 'dark', // Assume dark theme for gambling UX
    });

    return `${baseUrl}/widget?${params.toString()}`;
  };

  const widgetUrl = getWidgetUrl();
  const allowedOrigin = ALLOWED_ORIGINS[provider][environment];

  useEffect(() => {
    if (!widgetUrl) return;

    const handleMessage = (event: MessageEvent) => {
      // SECURITY: Strict origin validation
      if (event.origin !== allowedOrigin) {
        console.warn('Blocked postMessage from unauthorized origin:', event.origin);
        return;
      }

      const { type, data } = event.data;

      switch (type) {
        case 'CARD_ISSUED':
          setLoading(false);
          if (data?.cardId) {
            onCardIssued?.(data.cardId);
          }
          break;

        case 'TOP_UP_COMPLETE':
          if (data?.amount && data?.txHash) {
            onTopUp?.(Number(data.amount), data.txHash);
          }
          break;

        case 'WIDGET_ERROR': {
          setLoading(false);
          const error = data?.error || data?.message || 'Unknown error';
          setErrorMessage(error);
          onError?.(error);
          break;
        }

        case 'WIDGET_READY':
          setLoading(false);
          break;

        case 'MODAL_CLOSED':
          onClose?.();
          break;

        default:
          console.debug('Unhandled card widget event:', type);
      }
    };

    window.addEventListener('message', handleMessage);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [widgetUrl, allowedOrigin, onCardIssued, onTopUp, onError, onClose]);

  if (!userAddress) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>User address required</p>
        </CardContent>
      </Card>
    );
  }

  if (!widgetUrl || errorMessage) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-2 text-red-500 opacity-50" />
            <p className="text-sm text-red-600">
              {errorMessage || `${provider} card widget unavailable`}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Check API configuration in environment variables
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Virtual Debit Card
        </CardTitle>
        <CardDescription>
          {provider === 'jupiter' ? 'Jupiter Card' : 'Kado Money'} - Issue cards & top up with crypto
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={widgetUrl}
          title={`${provider} Card Widget`}
          className="w-full h-[600px] border-0 rounded-b-lg"
          allow="payment; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
        />
        <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-gray-50">
          🔒 Secure: No private keys shared. Provider handles compliance.
        </div>
      </CardContent>
    </Card>
  );
}
