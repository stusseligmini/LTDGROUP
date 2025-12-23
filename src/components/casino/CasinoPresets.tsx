'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CASINO_PRESETS, type CasinoPreset } from '@/lib/casino';
import { getTokenPrice, formatPrice } from '@/lib/prices/coingecko';
import { ExternalLink, Zap, TrendingUp } from 'lucide-react';

interface CasinoPresetsProps {
  onSelect?: (casino: CasinoPreset, amount: number) => void;
}

export function CasinoPresets({ onSelect }: CasinoPresetsProps) {
  const [selectedCasino, setSelectedCasino] = useState<CasinoPreset | null>(null);
  const [amount, setAmount] = useState('');
  const [solPrice, setSolPrice] = useState(0);

  useEffect(() => {
    getTokenPrice('SOL').then(price => {
      if (price) setSolPrice(price.usd);
    });
  }, []);

  const usdValue = parseFloat(amount || '0') * solPrice;

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleDeposit = () => {
    if (selectedCasino && amount && parseFloat(amount) > 0 && onSelect) {
      onSelect(selectedCasino, parseFloat(amount));
    }
  };

  return (
    <div className="space-y-6">
      {/* Casino Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CASINO_PRESETS.map((casino) => (
          <Card
            key={casino.id}
            className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${
              selectedCasino?.id === casino.id ? 'ring-2 ring-primary border-primary' : ''
            }`}
            onClick={() => setSelectedCasino(casino)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {casino.name}
                    {casino.instantDeposit && (
                      <Badge variant="secondary" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Instant
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">{casino.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(casino.website, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Min Deposit:</span>
                <span className="font-semibold">{casino.minDeposit} {casino.currency}</span>
              </div>
              {casino.tags && casino.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {casino.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deposit Form */}
      {selectedCasino && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Deposit to {selectedCasino.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  Send {selectedCasino.currency} directly to your casino account
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount ({selectedCasino.currency})
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min={selectedCasino.minDeposit}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min: ${selectedCasino.minDeposit} ${selectedCasino.currency}`}
                  className="pr-24"
                />
                {usdValue > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                     {formatPrice(usdValue)}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[0.1, 0.5, 1, 5].map(val => (
                <Button
                  key={val}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(val)}
                  className="font-semibold"
                >
                  {val} {selectedCasino.currency}
                </Button>
              ))}
            </div>

            {/* Deposit Address */}
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Deposit Address:</p>
              <p className="font-mono text-sm break-all text-foreground">{selectedCasino.depositAddress}</p>
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3 space-y-1.5 text-xs">
              <p className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400">?</span>
                <span>Minimum deposit: <strong>{selectedCasino.minDeposit} {selectedCasino.currency}</strong></span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400"></span>
                <span>Only send {selectedCasino.currency} on <strong>Solana</strong> network</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400"></span>
                <span>Deposits arrive in <strong>1-5 minutes</strong></span>
              </p>
            </div>

            {/* Deposit Button */}
            <Button
              onClick={handleDeposit}
              disabled={!amount || parseFloat(amount) < selectedCasino.minDeposit}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              <Zap className="mr-2 h-5 w-5" />
              Deposit {amount || '0'} {selectedCasino.currency} to {selectedCasino.name}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
