'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/apiClient';

interface Card {
  id: string;
  last4: string;
  brand: 'VISA' | 'MASTERCARD';
  status: 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  spendingLimit: number;
  currentSpending: number;
  currency: string;
  createdAt: string;
}

export default function CardsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/splash');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadCards = async () => {
      if (user) {
        await fetchCards();
      }
    };
    loadCards();
  }, [user]);

  const fetchCards = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<{ cards: Card[] }>('/cards');
      setCards(data.cards || []);
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError('Failed to load cards');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-cyan-primary bg-cyan-primary/20 border-cyan-primary/30';
      case 'FROZEN':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      case 'CANCELLED':
        return 'text-red-400 bg-red-400/20 border-red-400/30';
      default:
        return 'text-gray-400 bg-gray-400/20 border-gray-400/30';
    }
  };

  const getBrandColor = (brand: string) => {
    return brand === 'VISA' ? 'text-blue-400' : 'text-orange-400';
  };

  const calculateSpendingPercentage = (current: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold heading-gradient mb-2">Virtual Cards</h1>
            <p className="text-gray-400">Manage your VISA & Mastercard virtual cards</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-dark-card rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan-primary/20 text-cyan-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-cyan-primary/20 text-cyan-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>

            {/* Create card button */}
            <Link
              href="/cards/create"
              className="btn-primary ring-glow px-6 py-3 text-sm font-bold inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Card
            </Link>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="cel-error">
            <p>{error}</p>
            <button onClick={fetchCards} className="text-sm underline mt-2">
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="cel-loading">
              <div className="cel-loading__spinner"></div>
              <span className="cel-loading__label">Loading cards...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && cards.length === 0 && (
          <div className="glass-panel border-gradient p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-primary/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-cyan-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Cards Yet</h3>
            <p className="text-gray-400 mb-6">
              Create your first virtual card to start spending with crypto cashback
            </p>
            <Link href="/cards/create" className="btn-primary ring-glow px-8 py-3 inline-block">
              Create Your First Card
            </Link>
          </div>
        )}

        {/* Cards grid view */}
        {!isLoading && !error && cards.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => {
              const spendingPercentage = calculateSpendingPercentage(
                card.currentSpending,
                card.spendingLimit
              );

              return (
                <Link
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="glass-panel border-gradient hover-lift p-6 space-y-4 group cursor-pointer"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-bold ${getBrandColor(card.brand)}`}>
                      {card.brand}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(
                        card.status
                      )}`}
                    >
                      {card.status}
                    </span>
                  </div>

                  {/* Card number */}
                  <div className="text-white font-mono text-xl tracking-wider">
                    •••• •••• •••• {card.last4}
                  </div>

                  {/* Spending progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Spending</span>
                      <span className="text-white font-semibold">
                        {card.currency} {card.currentSpending.toLocaleString()} /{' '}
                        {card.spendingLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-dark-surface rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          spendingPercentage >= 90
                            ? 'bg-red-500'
                            : spendingPercentage >= 70
                            ? 'bg-yellow-500'
                            : 'bg-cyan-primary'
                        }`}
                        style={{ width: `${spendingPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
                    <span>Created {new Date(card.createdAt).toLocaleDateString()}</span>
                    <span className="text-cyan-primary group-hover:text-white transition-colors">
                      View Details →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Cards list view */}
        {!isLoading && !error && cards.length > 0 && viewMode === 'list' && (
          <div className="glass-panel border-gradient divide-y divide-gray-700">
            {cards.map((card) => {
              const spendingPercentage = calculateSpendingPercentage(
                card.currentSpending,
                card.spendingLimit
              );

              return (
                <Link
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="flex items-center gap-6 p-6 hover:bg-dark-card/50 transition-colors group"
                >
                  {/* Brand icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-dark-surface flex items-center justify-center">
                      <span className={`text-lg font-bold ${getBrandColor(card.brand)}`}>
                        {card.brand[0]}
                      </span>
                    </div>
                  </div>

                  {/* Card info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-semibold">
                        {card.brand} •••• {card.last4}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(
                          card.status
                        )}`}
                      >
                        {card.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>
                        {card.currency} {card.currentSpending.toLocaleString()} /{' '}
                        {card.spendingLimit.toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{new Date(card.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Spending bar */}
                  <div className="flex-shrink-0 w-32">
                    <div className="w-full bg-dark-surface rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          spendingPercentage >= 90
                            ? 'bg-red-500'
                            : spendingPercentage >= 70
                            ? 'bg-yellow-500'
                            : 'bg-cyan-primary'
                        }`}
                        style={{ width: `${spendingPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1 text-center">
                      {spendingPercentage.toFixed(0)}%
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-cyan-primary transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
