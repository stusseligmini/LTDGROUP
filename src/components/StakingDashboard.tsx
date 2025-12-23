'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

interface StakingPosition {
  id: string;
  blockchain: string;
  protocol: string;
  stakedAmount: string;
  rewardsEarned: string;
  currentApy: number;
  status: string;
}

export default function StakingDashboard() {
  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchPositions(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchPositions = async (signal?: AbortSignal) => {
    try {
      const response = await axios.get('/api/staking', {
        signal,
        timeout: 8000,
      });
      setPositions(response.data.positions);
    } catch (error) {
      if (axios.isCancel(error)) {
        return; // Request cancelled
      }
      logger.error('Error fetching staking positions', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading positions...</div>;
  }

  const totalStaked = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.stakedAmount),
    0
  );

  const totalRewards = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.rewardsEarned),
    0
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Staking Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Staked</p>
          <p className="text-3xl font-bold text-gray-900">${totalStaked.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Total Rewards</p>
          <p className="text-3xl font-bold text-green-600">${totalRewards.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Active Positions</p>
          <p className="text-3xl font-bold text-indigo-600">{positions.length}</p>
        </div>
      </div>

      {/* Positions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protocol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staked</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">APY</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rewards</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {positions.map((position) => (
              <tr key={position.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900 capitalize">{position.blockchain}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{position.protocol}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-gray-900">{position.stakedAmount}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-green-600">{position.currentApy?.toFixed(2)}%</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-green-600">+{position.rewardsEarned}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    position.status === 'active' ? 'bg-green-100 text-green-700' :
                    position.status === 'unstaking' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {position.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}









