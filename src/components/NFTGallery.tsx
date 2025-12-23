'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { logger } from '@/lib/logger';

interface NFT {
  id: string;
  name?: string;
  imageUrl?: string;
  contractAddress: string;
  tokenId: string;
  blockchain: string;
}

export default function NFTGallery() {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchNFTs(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchNFTs = async (signal?: AbortSignal) => {
    try {
      const response = await axios.get('/api/nfts', {
        signal,
        timeout: 8000,
      });
      setNfts(response.data.nfts);
    } catch (error) {
      if (axios.isCancel(error)) {
        return; // Request cancelled
      }
      logger.error('Error fetching NFTs', error instanceof Error ? error : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading NFTs...</div>;
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No NFTs found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {nfts.map((nft) => (
        <div
          key={nft.id}
          className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
        >
          <div className="aspect-square bg-gray-200">
            {nft.imageUrl ? (
              <img
                src={nft.imageUrl}
                alt={nft.name || 'NFT'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg truncate">
              {nft.name || `Token #${nft.tokenId}`}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {nft.contractAddress.substring(0, 6)}...
              {nft.contractAddress.substring(nft.contractAddress.length - 4)}
            </p>
            <span className="inline-block mt-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded">
              {nft.blockchain}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

