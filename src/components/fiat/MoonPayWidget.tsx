/**
 * MoonPay Widget Component
 * Embeddable widget for buying crypto with credit card
 * NO CUSTODY - crypto goes directly to user's wallet
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { getMoonPayWidgetUrl, MoonPayWidgetOptions, MoonPayConfig } from '@/lib/fiat/moonpay';

interface MoonPayWidgetProps {
  address: string;
  apiKey: string;
  environment?: 'sandbox' | 'production';
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  options?: Partial<MoonPayWidgetOptions>;
}

export function MoonPayWidget({
  address,
  apiKey,
  environment = 'production',
  onSuccess,
  onError,
  onClose,
  options = {},
}: MoonPayWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    if (!address || !apiKey) {
      return;
    }

    const config: MoonPayConfig = {
      apiKey,
      environment,
    };

    const widgetOptions: MoonPayWidgetOptions = {
      address,
      defaultCryptoCurrency: 'sol',
      ...options,
    };

    const widgetUrl = getMoonPayWidgetUrl(config, widgetOptions);

    // Listen for MoonPay messages
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      if (!event.origin.includes('moonpay.com')) {
        return;
      }

      if (event.data.type === 'MOONPAY_TRANSACTION_UPDATED') {
        const { transaction } = event.data;
        
        if (transaction.status === 'completed') {
          onSuccess?.(transaction.cryptoTransactionHash);
        } else if (transaction.status === 'failed') {
          onError?.(new Error(transaction.failureReason || 'Transaction failed'));
        }
      } else if (event.data.type === 'MOONPAY_MODAL_CLOSED') {
        onClose?.();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [address, apiKey, environment, onSuccess, onError, onClose, options]);

  if (!address || !apiKey) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <p className="font-medium">Configuration Error</p>
        <p className="text-sm mt-1">Address and API key are required</p>
      </div>
    );
  }

  const config: MoonPayConfig = {
    apiKey,
    environment,
  };

  const widgetOptions: MoonPayWidgetOptions = {
    address,
    defaultCryptoCurrency: 'sol',
    ...options,
  };

  const widgetUrl = getMoonPayWidgetUrl(config, widgetOptions);

  return (
    <div className="relative w-full bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: '600px' }}>
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10 rounded-lg">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600 font-medium">Loading MoonPay...</p>
          </div>
        </div>
      )}

      {/* MoonPay Widget Iframe */}
      <iframe
        ref={iframeRef}
        src={widgetUrl}
        width="100%"
        height="100%"
        className="border-0 rounded-lg"
        allow="payment"
        title="MoonPay Widget"
        onLoad={() => setIsLoading(false)}
        style={{ minHeight: '600px' }}
      />
    </div>
  );
}

