/**
 * Card Management Component
 * Displays and manages virtual cards
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VirtualCard, CardDetails } from '@/types/api';
import { logger } from '@/lib/logger';

interface CardManagementProps {
  walletId?: string;
}

export function CardManagement({ walletId }: CardManagementProps) {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state for creating new card
  const [newCard, setNewCard] = useState({
    nickname: '',
    brand: 'VISA' as 'VISA' | 'MASTERCARD',
    spendingLimit: '',
    dailyLimit: '',
    monthlyLimit: '',
  });

  const loadCards = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const url = walletId 
        ? `/api/cards?walletId=${walletId}` 
        : '/api/cards';
      
      const timeoutId = setTimeout(() => signal && new AbortController().abort(), 8000);
      
      const response = await fetch(url, {
        credentials: 'include',
        signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (data.success) {
        setCards(data.data.cards);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, ignore error
      }
      logger.error('Failed to load cards', error instanceof Error ? error : undefined, { walletId });
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    const controller = new AbortController();
    loadCards(controller.signal);
    return () => controller.abort();
  }, [walletId, loadCards]);

  const handleCreateCard = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          walletId,
          nickname: newCard.nickname || undefined,
          brand: newCard.brand,
          spendingLimit: newCard.spendingLimit ? parseFloat(newCard.spendingLimit) : undefined,
          dailyLimit: newCard.dailyLimit ? parseFloat(newCard.dailyLimit) : undefined,
          monthlyLimit: newCard.monthlyLimit ? parseFloat(newCard.monthlyLimit) : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadCards();
        setIsCreating(false);
        setNewCard({
          nickname: '',
          brand: 'VISA',
          spendingLimit: '',
          dailyLimit: '',
          monthlyLimit: '',
        });
      }
    } catch (error) {
      logger.error('Failed to create card', error instanceof Error ? error : undefined, { walletId });
    } finally {
      setLoading(false);
    }
  };

  const handleShowFullDetails = async (cardId: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}?full=true`, {
        credentials: 'include', // Include cookies for authentication
      });
      
      const data = await response.json();
      if (data.success) {
        setSelectedCard(data.data.card);
        setShowDetails(true);
      }
    } catch (error) {
      logger.error('Failed to load card details', error instanceof Error ? error : undefined);
    }
  };

  const handleFreezeCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ status: 'frozen' }),
      });

      if (response.ok) {
        await loadCards();
      }
    } catch (error) {
      logger.error('Failed to freeze card', error instanceof Error ? error : undefined, { cardId });
    }
  };

  const handleUnfreezeCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ status: 'active' }),
      });

      if (response.ok) {
        await loadCards();
      }
    } catch (error) {
      logger.error('Failed to unfreeze card', error instanceof Error ? error : undefined, { cardId });
    }
  };

  const handleCancelCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to cancel this card? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
      });

      if (response.ok) {
        await loadCards();
      }
    } catch (error) {
      logger.error('Failed to cancel card', error instanceof Error ? error : undefined, { cardId });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'frozen': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && cards.length === 0) {
    return <div className="text-center py-8">Loading cards...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Virtual Cards</h2>
          <p className="text-gray-600">Manage your virtual payment cards</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          {isCreating ? 'Cancel' : 'Create New Card'}
        </Button>
      </div>

      {/* Create Card Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Virtual Card</CardTitle>
            <CardDescription>Create a new virtual card linked to your wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nickname">Card Nickname (Optional)</Label>
              <Input
                id="nickname"
                value={newCard.nickname}
                onChange={(e) => setNewCard({ ...newCard, nickname: e.target.value })}
                placeholder="e.g., Shopping Card"
              />
            </div>

            <div>
              <Label htmlFor="brand">Card Brand</Label>
              <select
                id="brand"
                className="w-full border rounded-md p-2"
                value={newCard.brand}
                onChange={(e) => setNewCard({ ...newCard, brand: e.target.value as 'VISA' | 'MASTERCARD' })}
              >
                <option value="VISA">VISA</option>
                <option value="MASTERCARD">MASTERCARD</option>
              </select>
            </div>

            <div>
              <Label htmlFor="spendingLimit">Spending Limit (Optional)</Label>
              <Input
                id="spendingLimit"
                type="number"
                value={newCard.spendingLimit}
                onChange={(e) => setNewCard({ ...newCard, spendingLimit: e.target.value })}
                placeholder="e.g., 5000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dailyLimit">Daily Limit</Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  value={newCard.dailyLimit}
                  onChange={(e) => setNewCard({ ...newCard, dailyLimit: e.target.value })}
                  placeholder="e.g., 500"
                />
              </div>
              <div>
                <Label htmlFor="monthlyLimit">Monthly Limit</Label>
                <Input
                  id="monthlyLimit"
                  type="number"
                  value={newCard.monthlyLimit}
                  onChange={(e) => setNewCard({ ...newCard, monthlyLimit: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
            </div>

            <Button onClick={handleCreateCard} disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Card'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cards List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {card.nickname || `${card.brand} Card`}
                  </CardTitle>
                  <CardDescription>**** **** **** {card.lastFourDigits}</CardDescription>
                </div>
                <Badge className={getStatusColor(card.status)}>
                  {card.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <p className="text-gray-600">Cardholder</p>
                <p className="font-medium">{card.cardholderName}</p>
              </div>

              <div className="text-sm">
                <p className="text-gray-600">Expiry</p>
                <p className="font-medium">
                  {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                </p>
              </div>

              {card.monthlySpent !== undefined && card.monthlyLimit && (
                <div className="text-sm">
                  <p className="text-gray-600">Monthly Spending</p>
                  <p className="font-medium">
                    ${card.monthlySpent.toFixed(2)} / ${card.monthlyLimit.toFixed(2)}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (card.monthlySpent / card.monthlyLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShowFullDetails(card.id)}
                >
                  View Details
                </Button>
                
                {card.status === 'active' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFreezeCard(card.id)}
                  >
                    Freeze
                  </Button>
                )}
                
                {card.status === 'frozen' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnfreezeCard(card.id)}
                  >
                    Unfreeze
                  </Button>
                )}
                
                {card.status !== 'cancelled' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleCancelCard(card.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {cards.length === 0 && !isCreating && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600 mb-4">No cards yet</p>
            <Button onClick={() => setIsCreating(true)}>Create Your First Card</Button>
          </CardContent>
        </Card>
      )}

      {/* Full Card Details Modal */}
      {showDetails && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Card Details</CardTitle>
              <CardDescription>Keep this information secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Card Number</Label>
                <p className="font-mono text-lg">{selectedCard.cardNumber}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CVV</Label>
                  <p className="font-mono text-lg">{selectedCard.cvv}</p>
                </div>
                <div>
                  <Label>Expiry</Label>
                  <p className="font-mono text-lg">
                    {String(selectedCard.expiryMonth).padStart(2, '0')}/{selectedCard.expiryYear}
                  </p>
                </div>
              </div>

              <div>
                <Label>Cardholder Name</Label>
                <p className="font-medium">{selectedCard.cardholderName}</p>
              </div>

              <Button 
                onClick={() => {
                  setShowDetails(false);
                  setSelectedCard(null);
                }} 
                className="w-full"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
