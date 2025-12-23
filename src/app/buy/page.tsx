/**
 * Buy SOL Page - Stripe Crypto On-Ramp Integration
 * Allows users to purchase SOL with credit/debit card
 */

'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Shield, Zap, CheckCircle } from 'lucide-react';
import { StripeOnRampWidget } from '@/components/fiat/StripeOnRampWidget';

export default function BuyPage() {
  const { user } = useAuthContext();
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showWidget, setShowWidget] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  useEffect(() => {
    // Get user's Solana wallet address
    const fetchWalletAddress = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/wallet/summary');
        const data = await response.json();
        
        if (data.holdings && data.holdings.length > 0) {
          const solWallet = data.holdings.find((h: any) => h.currency === 'SOL');
          if (solWallet) {
            setWalletAddress(solWallet.address);
          }
        }
      } catch (error) {
        console.error('Failed to fetch wallet address:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletAddress();
  }, [user]);

  const handleSuccess = (sessionId: string) => {
    console.log('[Buy] Purchase completed:', sessionId);
    setPurchaseComplete(true);
    setShowWidget(false);
    
    // Refresh wallet balance
    fetch('/api/wallet/refresh', { method: 'POST' }).catch(console.error);
  };

  const handleError = (error: Error) => {
    console.error('[Buy] Purchase failed:', error);
    alert(`Purchase failed: ${error.message}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl py-12">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to buy SOL with your credit card.
          </p>
          <Button onClick={() => window.location.href = '/signin'}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  if (purchaseComplete) {
    return (
      <div className="container max-w-4xl py-12">
        <Card className="p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-4">Purchase Complete! 🎉</h1>
          <p className="text-muted-foreground mb-6">
            Your SOL will arrive in your wallet shortly. You can check your balance in the wallet tab.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => window.location.href = '/wallet'}>
              View Wallet
            </Button>
            <Button variant="outline" onClick={() => {
              setPurchaseComplete(false);
              setShowWidget(true);
            }}>
              Buy More
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (showWidget && walletAddress) {
    return (
      <div className="container max-w-4xl py-12">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setShowWidget(false)}>
            ← Back
          </Button>
        </div>
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Buy SOL with Stripe</h2>
          <StripeOnRampWidget
            walletAddress={walletAddress}
            destinationNetwork="solana"
            destinationCurrency="sol"
            onSuccess={handleSuccess}
            onError={handleError}
            onClose={() => setShowWidget(false)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Buy SOL</h1>
        <p className="text-muted-foreground">
          Purchase Solana instantly with your credit or debit card
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Instant Delivery</h3>
              <p className="text-sm text-muted-foreground">
                Receive SOL in your wallet within minutes
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Secure & Compliant</h3>
              <p className="text-sm text-muted-foreground">
                Powered by Stripe - trusted worldwide
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-primary/10 rounded-xl">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Purchase SOL</h2>
            <p className="text-sm text-muted-foreground">
              Delivery address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <ol className="text-sm text-muted-foreground space-y-2">
              <li>1. Click &quot;Buy with Stripe&quot; below</li>
              <li>2. Enter the amount of SOL you want to buy</li>
              <li>3. Complete payment with your credit/debit card</li>
              <li>4. SOL will be sent directly to your Celora wallet</li>
            </ol>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Note:</strong> Stripe may require identity verification (KYC) for compliance. 
              This is handled securely by Stripe and is required by law.
            </p>
          </div>

          <Button 
            onClick={() => setShowWidget(true)} 
            size="lg" 
            className="w-full"
            disabled={!walletAddress}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Buy with Stripe
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to Stripe&apos;s{' '}
            <a href="https://stripe.com/legal/end-users" target="_blank" className="underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="https://stripe.com/privacy" target="_blank" className="underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </Card>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Need help?{' '}
          <a href="https://t.me/celorawallet" target="_blank" className="underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
