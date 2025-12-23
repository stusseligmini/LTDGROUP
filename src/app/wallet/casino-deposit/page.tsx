'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CasinoPresets } from '@/components/casino/CasinoPresets';
import { SendTransaction } from '@/components/wallet/SendTransaction';
import { type CasinoPreset } from '@/lib/casino';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Coins, AlertTriangle } from 'lucide-react';

export default function CasinoDepositPage() {
  const router = useRouter();
  const [selectedCasino, setSelectedCasino] = useState<CasinoPreset | null>(null);
  const [prefilledAmount, setPrefilledAmount] = useState<string>('');

  const handleCasinoSelect = (casino: CasinoPreset, amount: number) => {
    setSelectedCasino(casino);
    setPrefilledAmount(amount.toString());
  };

  const handleSuccess = (signature: string) => {
    setTimeout(() => {
      router.push(`/wallet/history?highlight=${signature}`);
    }, 2000);
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.push('/wallet')} className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wallet
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <Coins className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Casino Deposits</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Instantly deposit to your favorite gambling platforms
        </p>
      </div>

      <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-900 dark:text-amber-200">
          <strong>Important:</strong> Only send SOL on Solana network. Sending other tokens or using wrong networks will result in permanent loss of funds.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <CasinoPresets onSelect={handleCasinoSelect} />
        </div>

        <div className="lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          {selectedCasino ? (
            <SendTransaction
              walletId={undefined}
              onSuccess={handleSuccess}
              prefilledRecipient={selectedCasino.depositAddress}
              prefilledAmount={prefilledAmount}
              readonlyRecipient={true}
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-center">Select a Casino</CardTitle>
                <CardDescription className="text-center">
                  Choose a casino from the list to start depositing
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-12">
                <div className="text-6xl mb-4"></div>
                <p className="text-muted-foreground text-lg">
                   Select a casino to continue
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
