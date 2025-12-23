/**
 * Ramp Network Widget Component
 * Embeddable widget for buying crypto with 30+ payment methods
 * Supports 150+ cryptocurrencies across multiple chains
 * NO CUSTODY - crypto goes directly to user's wallet
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { getRampWidgetConfig, RampWidgetOptions, RampConfig } from '@/lib/fiat/ramp';

interface RampWidgetProps {
  address: string;
  apiKey: string;
  environment?: 'sandbox' | 'production';
  onSuccess?: (purchaseData: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  options?: Partial<RampWidgetOptions>;
}

declare global {
  interface Window {
    RampInstances?: any;
  }
}

export function RampWidget({
  address,
  apiKey,
  environment = 'production',
  onSuccess,
  onError,
  onClose,
  options = {},
}: RampWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    if (!address || !apiKey) {
      return;
    }

    // Load Ramp SDK script
    const script = document.createElement('script');
    script.src = 'https://cdn.ramp.network/iframe';
    script.async = true;
    script.onload = () => {
      // Ramp SDK loaded
      setIsLoading(false);
    };
    script.onerror = () => {
      onError?.(new Error('Failed to load Ramp widget'));
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [apiKey, onError]);

  useEffect(() => {
    if (!address || !apiKey || !window.RampInstances || isLoading) {
      return;
    }

    const config: RampConfig = {
      hostApiKey: apiKey,
      hostAppName: 'Celora Wallet',
      environment,
    };

    const widgetOptions: RampWidgetOptions = {
      address,
      defaultAsset: 'SOL',
      ...options,
    };

    const widgetConfig = getRampWidgetConfig(config, widgetOptions);

    // Initialize Ramp widget
    if (containerRef.current && window.RampInstances) {
      try {
        const instance = new window.RampInstances.RampInstantSDK({
          hostAppName: 'Celora Wallet',
          hostApiKey: apiKey,
          userAddress: address,
          defaultAsset: 'SOL',
          onSuccess: (result: any) => {
            onSuccess?.(result);
          },
          onError: (error: any) => {
            onError?.(new Error(error.message || 'Ramp transaction failed'));
          },
          onClose: () => {
            onClose?.();
          },
        });

        instance.show();
      } catch (error: any) {
        onError?.(new Error(error.message || 'Failed to initialize Ramp widget'));
      }
    }
  }, [address, apiKey, environment, onSuccess, onError, onClose, isLoading, options]);

  if (!address || !apiKey) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <p className="font-medium">Configuration Error</p>
        <p className="text-sm mt-1">Address and API key are required</p>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ minHeight: '600px' }}>
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10 rounded-lg">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
              <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600 font-medium">Loading Ramp...</p>
          </div>
        </div>
      )}

      {/* Ramp Widget Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
    </div>
  );
}
