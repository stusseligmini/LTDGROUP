'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorDisplayProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'card' | 'inline';
}

export function ErrorDisplay({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  variant = 'card',
}: ErrorDisplayProps) {
  if (variant === 'inline') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-red-900 text-sm">{title}</p>
            <p className="text-sm text-red-700 mt-1 break-words">{error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                {retryLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">{title}</h3>
        <p className="text-sm text-red-700 mb-4 break-words">{error}</p>
        {onRetry && (
          <Button
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

