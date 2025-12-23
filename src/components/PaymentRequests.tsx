'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

interface PaymentRequest {
  id: string;
  amount: string;
  blockchain: string;
  memo?: string;
  status: string;
  sender: { displayName?: string; email: string };
  receiver: { displayName?: string; email: string };
  createdAt: string;
}

export default function PaymentRequests() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchRequests(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchRequests = async (signal?: AbortSignal) => {
    try {
      const response = await axios.get('/api/payment-requests', {
        signal,
        timeout: 8000, // 8 second timeout
      });
      setRequests(response.data.requests);
    } catch (error) {
      if (axios.isCancel(error)) {
        logger.info('Payment requests fetch cancelled');
        return;
      }
      if (axios.isAxiosError(error)) {
        if ((error as any).code === 'ECONNABORTED') {
          logger.error('Payment requests fetch timed out');
          alert('Request timed out. Please check your connection and try again.');
        } else if ((error as any).response?.status === 404) {
          setRequests([]);
        } else {
          logger.error('Error fetching payment requests', error);
          alert('Failed to load payment requests. Please try again.');
        }
      } else {
        logger.error('Error fetching payment requests', error instanceof Error ? error : undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFulfill = async (requestId: string) => {
    try {
      // In production, this would open a transaction modal
      const txHash = `0x${Date.now().toString(16)}`;
      
      await axios.post(`/api/payment-requests/${requestId}/fulfill`, {
        txHash,
      });

      await fetchRequests();
      alert('Payment sent!');
    } catch (error) {
      alert('Failed to send payment');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Payment Requests</h2>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No pending payment requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-600">From</p>
                  <p className="font-semibold">{request.sender.displayName || request.sender.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">
                    {request.amount} {request.blockchain}
                  </p>
                </div>
              </div>

              {request.memo && (
                <p className="text-sm text-gray-700 mb-4 italic">&quot;{request.memo}&quot;</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleFulfill(request.id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Pay
                </button>
                <button className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Decline
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Requested {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}









