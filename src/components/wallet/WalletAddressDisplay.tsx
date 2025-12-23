import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface DerivedAddresses {
  solana: string;
  ethereum: string;
}

interface WalletAddressDisplayProps {
  address?: string;
  blockchain?: string;
  label?: string;
  addresses?: DerivedAddresses;
  showDerivationPaths?: boolean;
  compact?: boolean;
}

export function WalletAddressDisplay({
  address,
  blockchain,
  label = 'Address',
  addresses,
  showDerivationPaths = false,
}: WalletAddressDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (addr: string, type?: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(type || 'single');
    setTimeout(() => setCopied(null), 2000);
  };

  // Display single address
  if (address) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <code className="flex-1 text-sm font-mono text-slate-600 break-all">
            {address}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopy(address)}
            className="shrink-0"
          >
            {copied === 'single' ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-600" />
            )}
          </Button>
        </div>
        {blockchain && <p className="text-xs text-slate-500">{blockchain}</p>}
      </div>
    );
  }

  // Display multiple addresses
  if (addresses) {
    return (
      <div className="space-y-4">
        {/* Solana Address */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Solana Address
            {showDerivationPaths && <span className="text-xs text-slate-500 ml-2">(m/44&apos;/501&apos;/0&apos;/0&apos;)</span>}
          </label>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <code className="flex-1 text-sm font-mono text-slate-600 break-all">
              {addresses.solana}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopy(addresses.solana, 'solana')}
              className="shrink-0"
            >
              {copied === 'solana' ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-slate-600" />
              )}
            </Button>
          </div>
        </div>

        {/* Ethereum Address */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Ethereum Address
            {showDerivationPaths && <span className="text-xs text-slate-500 ml-2">(m/44&apos;/60&apos;/0&apos;/0)</span>}
          </label>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <code className="flex-1 text-sm font-mono text-slate-600 break-all">
              {addresses.ethereum}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopy(addresses.ethereum, 'ethereum')}
              className="shrink-0"
            >
              {copied === 'ethereum' ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-slate-600" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
