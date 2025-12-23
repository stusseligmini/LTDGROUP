/**
 * Buy Success Page
 * Shown after successful Stripe purchase
 */

'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BuySuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Trigger balance refresh after purchase
    const refreshBalance = async () => {
      try {
        await fetch('/api/wallet/refresh', { method: 'POST' });
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
    };

    refreshBalance();
  }, []);

  return (
    <div className="container max-w-2xl py-12">
      <Card className="p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
            <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4">Purchase Successful!</h1>
        
        <p className="text-muted-foreground mb-8">
          Your SOL is on the way to your Celora wallet. 
          It typically arrives within 5-10 minutes.
        </p>

        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg mb-8">
          <p className="text-sm text-muted-foreground">
            You&apos;ll receive an email confirmation from Stripe with your transaction details.
            Your balance will update automatically once the transaction is confirmed on the blockchain.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => router.push('/wallet')}>
            View Wallet
          </Button>
          <Button variant="outline" onClick={() => router.push('/buy')}>
            Buy More SOL
          </Button>
        </div>
      </Card>
    </div>
  );
}
