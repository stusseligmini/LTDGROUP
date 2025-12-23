/**
 * Telegram Mini App - Virtual Cards
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { showBackButton, hideMainButton, haptic } from '@/lib/telegram/webapp';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/hooks/useTelegramAuth';
import type { VirtualCard } from '@/types/api';
import { logger } from '@/lib/logger';

export default function TelegramCardsPage() {
  const router = useRouter();
  const { userId, isAuthenticated } = useTelegramAuth();
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      showBackButton(() => router.push('/telegram'));
      hideMainButton();
    }
  }, [router]);

  const loadCards = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/cards', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      logger.error('Failed to load cards', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  }, [userId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      loadCards();
    }
  }, [isAuthenticated, userId, loadCards]);
  
  const handleFreeze = async (cardId: string) => {
    if (!userId) return;
    haptic('impact');
    try {
      await fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ status: 'frozen' }),
      });
      await loadCards();
      haptic('notification', 'success');
    } catch (_error: any) {
      haptic('notification', 'error');
    }
  };
  
  const handleUnfreeze = async (cardId: string) => {
    if (!userId) return;
    haptic('impact');
    try {
      await fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({ status: 'active' }),
      });
      await loadCards();
      haptic('notification', 'success');
    } catch (_error: any) {
      haptic('notification', 'error');
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">Virtual Cards</h1>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading cards...</p>
        </div>
      ) : cards.length > 0 ? (
        <div className="space-y-4">
          {cards.map((card) => (
            <div 
              key={card.id}
              className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-6 border border-slate-600 shadow-lg"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {card.nickname || `${card.brand} Card`}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">
                    •••• •••• •••• {card.lastFourDigits}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  card.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  card.status === 'frozen' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {card.status}
                </div>
              </div>
              
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-400">{card.cardholderName}</span>
                <span className="text-gray-400">
                  {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                </span>
              </div>
              
              {card.monthlyLimit && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Monthly Spending</span>
                    <span className="font-medium">
                      ${card.monthlySpent.toFixed(2)} / ${card.monthlyLimit.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-cyan-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (card.monthlySpent / card.monthlyLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                {card.status === 'active' ? (
                  <button 
                    onClick={() => handleFreeze(card.id)}
                    className="bg-yellow-600 hover:bg-yellow-700 py-2 rounded-lg text-sm font-medium transition"
                  >
                    ❄️ Freeze
                  </button>
                ) : (
                  <button 
                    onClick={() => handleUnfreeze(card.id)}
                    className="bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm font-medium transition"
                  >
                    🔥 Unfreeze
                  </button>
                )}
                <button 
                  onClick={() => {
                    haptic('impact');
                    // Navigate to card details
                  }}
                  className="bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-medium transition"
                >
                  👁️ Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700">
          <div className="text-5xl mb-4">💳</div>
          <p className="text-gray-400 mb-2">No cards yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Create virtual cards in the Celora app
          </p>
          <button 
            onClick={() => haptic('notification', 'warning')}
            className="bg-cyan-600 hover:bg-cyan-700 px-6 py-3 rounded-lg font-medium transition"
          >
            Open Celora App
          </button>
        </div>
      )}
    </div>
  );
}










