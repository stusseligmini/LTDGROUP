'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

export default function BudgetManager() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudget();
  }, []);

  const fetchBudget = async () => {
    try {
      const response = await axios.get('/api/budget');
      setSummary(response.data.summary);
    } catch (error) {
      logger.error('Error fetching budget', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const calculatePercentage = (spent: number, limit: number) => {
    return limit > 0 ? (spent / limit) * 100 : 0;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Budget & Spending Limits</h2>

      <div className="space-y-6">
        {/* Daily Limit */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Daily Limit</h3>
            <span className="text-2xl font-bold">
              ${summary?.daily?.spent?.toFixed(2) || '0.00'}
              <span className="text-sm text-gray-500"> / ${summary?.daily?.limit?.toFixed(2) || '0.00'}</span>
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                calculatePercentage(summary?.daily?.spent || 0, summary?.daily?.limit || 1) > 80
                  ? 'bg-red-500'
                  : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(
                  calculatePercentage(summary?.daily?.spent || 0, summary?.daily?.limit || 1),
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            ${summary?.daily?.remaining?.toFixed(2) || '0.00'} remaining
          </p>
        </div>

        {/* Weekly Limit */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Weekly Limit</h3>
            <span className="text-2xl font-bold">
              ${summary?.weekly?.spent?.toFixed(2) || '0.00'}
              <span className="text-sm text-gray-500"> / ${summary?.weekly?.limit?.toFixed(2) || '0.00'}</span>
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                calculatePercentage(summary?.weekly?.spent || 0, summary?.weekly?.limit || 1) > 80
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
              style={{
                width: `${Math.min(
                  calculatePercentage(summary?.weekly?.spent || 0, summary?.weekly?.limit || 1),
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            ${summary?.weekly?.remaining?.toFixed(2) || '0.00'} remaining
          </p>
        </div>

        {/* Monthly Limit */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Monthly Limit</h3>
            <span className="text-2xl font-bold">
              ${summary?.monthly?.spent?.toFixed(2) || '0.00'}
              <span className="text-sm text-gray-500"> / ${summary?.monthly?.limit?.toFixed(2) || '0.00'}</span>
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                calculatePercentage(summary?.monthly?.spent || 0, summary?.monthly?.limit || 1) > 80
                  ? 'bg-red-500'
                  : 'bg-indigo-500'
              }`}
              style={{
                width: `${Math.min(
                  calculatePercentage(summary?.monthly?.spent || 0, summary?.monthly?.limit || 1),
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            ${summary?.monthly?.remaining?.toFixed(2) || '0.00'} remaining
          </p>
        </div>
      </div>
    </div>
  );
}









