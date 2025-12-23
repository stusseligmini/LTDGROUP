'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/apiClient';

interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  balance: number;
  label?: string;
}

interface CardFormData {
  walletId: string;
  brand: 'VISA' | 'MASTERCARD';
  spendingLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
  currency: string;
  allowedMerchantCategories: string[];
  allowedCountries: string[];
  onlineEnabled: boolean;
  atmEnabled: boolean;
  cashbackRate: number;
}

const STEP_TITLES = [
  'Select Wallet',
  'Choose Brand',
  'Set Limits',
  'Configure Controls',
  'Review & Create',
];

const MERCHANT_CATEGORIES = [
  { code: '5411', name: 'Grocery Stores' },
  { code: '5812', name: 'Restaurants' },
  { code: '5541', name: 'Gas Stations' },
  { code: '5999', name: 'Online Shopping' },
  { code: '7995', name: 'Casino/Gaming' },
  { code: '4111', name: 'Transportation' },
  { code: '5912', name: 'Pharmacies' },
  { code: '5732', name: 'Electronics' },
];

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NO', name: 'Norway' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
];

export default function CreateCardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CardFormData>({
    walletId: '',
    brand: 'VISA',
    spendingLimit: 10000,
    dailyLimit: 1000,
    monthlyLimit: 5000,
    currency: 'USD',
    allowedMerchantCategories: [],
    allowedCountries: ['US', 'NO', 'GB'],
    onlineEnabled: true,
    atmEnabled: false,
    cashbackRate: 2.0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      const data = await api.get<{ wallets: Wallet[] }>(
        '/wallet/list'
      );
      setWallets(data.wallets || []);
    } catch (err) {
      console.error('Error fetching wallets:', err);
      setError('Failed to load wallets');
    }
  };

  const handleNext = () => {
    if (currentStep < STEP_TITLES.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.post<{ card: { id: string } }>(
        '/cards',
        formData
      );
      router.push(`/cards/${data.card.id}`);
    } catch (err: any) {
      console.error('Error creating card:', err);
      setError(err.message || 'Failed to create card');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMerchantCategory = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedMerchantCategories: prev.allowedMerchantCategories.includes(code)
        ? prev.allowedMerchantCategories.filter((c) => c !== code)
        : [...prev.allowedMerchantCategories, code],
    }));
  };

  const toggleCountry = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedCountries: prev.allowedCountries.includes(code)
        ? prev.allowedCountries.filter((c) => c !== code)
        : [...prev.allowedCountries, code],
    }));
  };

  if (authLoading || !user) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="cel-loading">
            <div className="cel-loading__spinner"></div>
            <span className="cel-loading__label">Loading...</span>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Virtual Card</h1>
          <p className="text-gray-400">Set up your new VISA or Mastercard with custom controls</p>
        </div>

        {/* Progress bar */}
        <div className="modern-card p-6">
          <div className="flex items-center justify-between mb-4">
            {STEP_TITLES.map((title, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                      index <= currentStep
                        ? 'bg-cyan-primary/20 border-cyan-primary text-cyan-primary'
                        : 'bg-dark-surface border-gray-600 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 text-center ${
                      index <= currentStep ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    {title}
                  </span>
                </div>
                {index < STEP_TITLES.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      index < currentStep ? 'bg-cyan-primary' : 'bg-gray-600'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="cel-error">
            <p>{error}</p>
          </div>
        )}

        {/* Step content */}
        <div className="modern-card p-8">
          {/* Step 1: Select Wallet */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Select Funding Wallet</h2>
                <p className="text-gray-400">Choose which wallet will fund this card</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setFormData({ ...formData, walletId: wallet.id })}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      formData.walletId === wallet.id
                        ? 'border-cyan-primary bg-cyan-primary/10'
                        : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-semibold text-white">
                        {wallet.label || wallet.blockchain}
                      </span>
                      <span className="text-sm font-bold text-cyan-primary">
                        ${wallet.balance.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 font-mono truncate">
                      {wallet.address}
                    </div>
                  </button>
                ))}
              </div>

              {wallets.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>No wallets found. Create a wallet first to fund your card.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose Brand */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Choose Card Brand</h2>
                <p className="text-gray-400">Select VISA or Mastercard</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => setFormData({ ...formData, brand: 'VISA' })}
                  className={`p-8 rounded-lg border-2 transition-all ${
                    formData.brand === 'VISA'
                      ? 'border-cyan-primary bg-cyan-primary/10'
                      : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-400 mb-4">VISA</div>
                    <p className="text-gray-400 text-sm">Most widely accepted worldwide</p>
                  </div>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, brand: 'MASTERCARD' })}
                  className={`p-8 rounded-lg border-2 transition-all ${
                    formData.brand === 'MASTERCARD'
                      ? 'border-cyan-primary bg-cyan-primary/10'
                      : 'border-gray-600 hover:border-gray-500 bg-dark-surface'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-5xl font-bold text-orange-400 mb-4">MASTERCARD</div>
                    <p className="text-gray-400 text-sm">Premium merchant benefits</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Set Limits */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Set Spending Limits</h2>
                <p className="text-gray-400">Configure daily, monthly, and total limits</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Daily Limit ({formData.currency})
                  </label>
                  <input
                    type="number"
                    value={formData.dailyLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, dailyLimit: Number(e.target.value) })
                    }
                    className="neon-input w-full px-4 py-3"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Limit ({formData.currency})
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyLimit: Number(e.target.value) })
                    }
                    className="neon-input w-full px-4 py-3"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Limit ({formData.currency})
                  </label>
                  <input
                    type="number"
                    value={formData.spendingLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, spendingLimit: Number(e.target.value) })
                    }
                    className="neon-input w-full px-4 py-3"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Crypto Cashback Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.cashbackRate}
                    onChange={(e) =>
                      setFormData({ ...formData, cashbackRate: Number(e.target.value) })
                    }
                    className="neon-input w-full px-4 py-3"
                    min="0"
                    max="10"
                    step="0.1"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Earn crypto back on every purchase
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Configure Controls */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Configure Card Controls</h2>
                <p className="text-gray-400">Set merchant categories and location restrictions</p>
              </div>

              {/* Merchant Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Allowed Merchant Categories (Leave empty for all)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {MERCHANT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.code}
                      onClick={() => toggleMerchantCategory(cat.code)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        formData.allowedMerchantCategories.includes(cat.code)
                          ? 'border-cyan-primary bg-cyan-primary/10 text-white'
                          : 'border-gray-600 bg-dark-surface text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm font-medium">{cat.name}</div>
                      <div className="text-xs text-gray-500">{cat.code}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Countries */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Allowed Countries
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {COUNTRIES.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => toggleCountry(country.code)}
                      className={`p-3 rounded-lg border transition-all text-center ${
                        formData.allowedCountries.includes(country.code)
                          ? 'border-cyan-primary bg-cyan-primary/10 text-white'
                          : 'border-gray-600 bg-dark-surface text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm font-medium">{country.code}</div>
                      <div className="text-xs text-gray-500">{country.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface">
                  <div>
                    <div className="font-medium text-white">Online Payments</div>
                    <div className="text-sm text-gray-400">Allow e-commerce purchases</div>
                  </div>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, onlineEnabled: !formData.onlineEnabled })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.onlineEnabled ? 'bg-cyan-primary' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.onlineEnabled ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-dark-surface">
                  <div>
                    <div className="font-medium text-white">ATM Withdrawals</div>
                    <div className="text-sm text-gray-400">Allow cash withdrawals</div>
                  </div>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, atmEnabled: !formData.atmEnabled })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      formData.atmEnabled ? 'bg-cyan-primary' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        formData.atmEnabled ? 'translate-x-6' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Review & Create</h2>
                <p className="text-gray-400">Confirm your card settings</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-dark-surface">
                  <div className="text-sm text-gray-400 mb-1">Card Brand</div>
                  <div className="text-lg font-semibold text-white">{formData.brand}</div>
                </div>

                <div className="p-4 rounded-lg bg-dark-surface">
                  <div className="text-sm text-gray-400 mb-1">Spending Limits</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-white">
                      <span>Daily:</span>
                      <span className="font-semibold">
                        {formData.currency} {formData.dailyLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Monthly:</span>
                      <span className="font-semibold">
                        {formData.currency} {formData.monthlyLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Total:</span>
                      <span className="font-semibold">
                        {formData.currency} {formData.spendingLimit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-dark-surface">
                  <div className="text-sm text-gray-400 mb-1">Cashback Rate</div>
                  <div className="text-lg font-semibold text-cyan-primary">
                    {formData.cashbackRate}% crypto cashback
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-dark-surface">
                  <div className="text-sm text-gray-400 mb-1">Controls</div>
                  <div className="space-y-1 text-white">
                    <div>Online Payments: {formData.onlineEnabled ? '✓ Enabled' : '✗ Disabled'}</div>
                    <div>ATM Withdrawals: {formData.atmEnabled ? '✓ Enabled' : '✗ Disabled'}</div>
                    <div>Allowed Countries: {formData.allowedCountries.length} selected</div>
                    {formData.allowedMerchantCategories.length > 0 && (
                      <div>Merchant Restrictions: {formData.allowedMerchantCategories.length} categories</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="btn-outline px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep < STEP_TITLES.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={currentStep === 0 && !formData.walletId}
              className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Card'}
            </button>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
