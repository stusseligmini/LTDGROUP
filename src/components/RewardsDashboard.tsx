'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

export default function RewardsDashboard() {
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const response = await axios.get('/api/rewards');
      setRewards(response.data);
    } catch (error) {
      logger.error('Error fetching rewards', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Rewards & Cashback</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Total Cashback Earned</p>
          <p className="text-4xl font-bold">${rewards?.totalRewards?.toFixed(2) || '0.00'}</p>
          <p className="text-sm opacity-90 mt-2">Lifetime earnings</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Loyalty Points</p>
          <p className="text-4xl font-bold">{Math.floor(rewards?.totalPoints || 0).toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-2">Redeem for rewards</p>
        </div>
      </div>

      {/* Cards with Rewards */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Cards</h3>
        <div className="space-y-4">
          {rewards?.cards?.map((card: any) => (
            <div key={card.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{card.nickname || 'Card'}</p>
                  <p className="text-sm text-gray-600">
                    {(parseFloat(card.cashbackRate) * 100).toFixed(1)}% cashback rate
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    ${parseFloat(card.rewardsEarned).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {Math.floor(parseFloat(card.loyaltyPoints))} pts
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Redeem Button */}
      <div className="mt-6">
        <button className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-lg font-semibold">
          Redeem Rewards
        </button>
      </div>
    </div>
  );
}









