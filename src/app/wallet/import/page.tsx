'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deriveSolanaWallet } from '@/lib/solana/solanaWallet';
import { WalletEncryption, storeWalletLocally, deriveMultipleWallets } from '@/lib/wallet/nonCustodialWallet';
import { WalletAddressDisplay } from '@/components/wallet/WalletAddressDisplay';
import { validateMnemonic } from 'bip39';
import { InfoIcon, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

type ImportStep = 'enter' | 'password' | 'addresses' | 'complete';

interface DerivedAddresses {
  solana: string;
  ethereum: string;
  bitcoin: string;
  celo: string;
}

export default function ImportWalletPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [step, setStep] = useState<ImportStep>('enter');
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [derivedAddresses, setDerivedAddresses] = useState<DerivedAddresses | null>(null);

  const mnemonicValid = mnemonic.trim().split(/\s+/).length === 12 || mnemonic.trim().split(/\s+/).length === 24;
  const mnemonicIsValid = mnemonicValid && validateMnemonic(mnemonic.trim());
  const passwordStrength = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleProceedToPassword = () => {
    if (!mnemonicIsValid) {
      setError('Invalid recovery phrase. Please check and try again.');
      return;
    }
    setError('');
    setStep('password');
  };

  const handleImportWallet = async () => {
    if (!passwordStrength || !passwordsMatch) {
      setError('Password requirements not met');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const trimmedMnemonic = mnemonic.trim();
      
      // Derive all addresses from the mnemonic
      const allWallets = await deriveMultipleWallets(trimmedMnemonic, ['solana', 'ethereum', 'bitcoin', 'celo']);
      
      const addresses: DerivedAddresses = {
        solana: '',
        ethereum: '',
        bitcoin: '',
        celo: '',
      };
      
      allWallets.forEach(wallet => {
        addresses[wallet.blockchain as keyof DerivedAddresses] = wallet.address;
      });
      
      setDerivedAddresses(addresses);
      setWalletAddress(addresses.solana); // Store primary address (Solana by default)
      setStep('addresses');
    } catch (err: any) {
      console.error('Wallet import error:', err);
      setError(err.message || 'Failed to derive wallet addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAddresses = async () => {
    if (!derivedAddresses) return;

    setLoading(true);
    setError('');

    try {
      const trimmedMnemonic = mnemonic.trim();
      const solanaWallet = await deriveSolanaWallet(trimmedMnemonic, 0);
      const encrypted = await WalletEncryption.encrypt(trimmedMnemonic, password);

      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchain: 'solana',
          address: solanaWallet.address,
          publicKey: Buffer.from(solanaWallet.publicKey.toBytes()).toString('hex'),
          label: 'Imported Solana Wallet',
          isDefault: true,
          derivationPath: "m/44'/501'/0'/0'",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import wallet');
      }

      const data = await response.json();
      const walletId = data.wallet?.id || data.id;
      storeWalletLocally(walletId, encrypted.encrypted, encrypted.salt, encrypted.iv);

      // SECURITY: Log wallet import for audit trail
      try {
        await fetch('/api/audit/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'wallet_imported',
            walletId,
            metadata: {
              blockchain: 'solana',
              address: solanaWallet.address.substring(0, 8) + '...' // Partial address for security
            }
          })
        });
      } catch (auditError) {
        console.error('Failed to log audit', auditError);
        // Don't block user flow if audit fails
      }

      setStep('complete');
    } catch (err: any) {
      console.error('Wallet import error:', err);
      setError(err.message || 'Failed to import wallet');
    } finally {
      setLoading(false);
    }
  };

  const _copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Import Existing Wallet</CardTitle>
          <CardDescription>Restore your wallet using your 12 or 24-word recovery phrase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'enter' && (
            <>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Your recovery phrase will be encrypted and stored locally on this device. Never share it with anyone.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Recovery Phrase (12 or 24 words)</label>
                  <textarea
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    placeholder="word1 word2 word3 ..."
                    className="w-full min-h-[120px] p-3 border rounded-md focus:ring-2 focus:ring-primary"
                    autoComplete="off"
                  />
                  {mnemonic && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      {mnemonicIsValid ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Valid recovery phrase</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-amber-600">
                            {mnemonicValid ? 'Invalid BIP39 phrase' : `Enter ${mnemonic.trim().split(/\s+/).length} of 12 or 24 words`}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => router.push('/wallet')} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleProceedToPassword} disabled={!mnemonicIsValid} className="flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'password' && (
            <>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Set a strong password to encrypt your recovery phrase on this device.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter strong password"
                    autoComplete="new-password"
                  />
                  {password && (
                    <div className="mt-2 text-sm">
                      <span className={passwordStrength ? 'text-green-600' : 'text-amber-600'}>
                        {passwordStrength ? '✓ Strong password' : '⚠ Needs uppercase + numbers (8+ chars)'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  {confirmPassword && (
                    <div className="mt-2 text-sm">
                      <span className={passwordsMatch ? 'text-green-600' : 'text-red-600'}>
                        {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('enter')} disabled={loading} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleImportWallet} disabled={!passwordStrength || !passwordsMatch || loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deriving...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'addresses' && derivedAddresses && (
            <>
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Your wallet has been derived across multiple blockchains. Verify the addresses below before confirming import.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Derived Wallet Addresses</h3>
                
                <WalletAddressDisplay addresses={derivedAddresses} showDerivationPaths={true} />

                <Alert variant="default" className="bg-blue-50 border-blue-200">
                  <InfoIcon className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    All addresses are derived from your recovery phrase. You can receive tokens on any of these addresses.
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('password')} disabled={loading} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleConfirmAddresses} disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      'Confirm & Import'
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'complete' && (
            <>
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Wallet Imported Successfully!</h3>
                  <p className="text-muted-foreground mb-4">
                    Your wallet has been restored across all supported blockchains and encrypted locally.
                  </p>
                  
                  {derivedAddresses && (
                    <div className="mb-6 text-left">
                      <p className="text-sm font-medium text-gray-400 mb-3">Your wallet addresses:</p>
                      <WalletAddressDisplay
                        addresses={derivedAddresses}
                        showDerivationPaths={false}
                        compact={true}
                      />
                    </div>
                  )}
                </div>

                <Button onClick={() => router.push('/wallet')} className="w-full">
                  Go to Wallet
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
