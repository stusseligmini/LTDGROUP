'use client';

import React, { useState } from 'react';
import ledgerService from '@/lib/hardware/ledger';
import trezorService from '@/lib/hardware/trezor';
import { logger } from '@/lib/logger';

export default function HardwareWalletConnect() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<'ledger' | 'trezor' | null>(null);

  const connectLedger = async () => {
    setConnecting(true);
    setError('');
    
    try {
      if (!ledgerService.isSupported()) {
        throw new Error('Ledger is not supported in this browser. Please use Chrome, Edge, or Opera.');
      }

      await ledgerService.connect();
      
      // Get Ethereum address by default
      const addr = await ledgerService.getEthereumAddress();
      
      setAddress(addr);
      setConnected(true);
      setSelectedWallet('ledger');
      
      alert('Ledger connected successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Ledger');
      logger.error('Ledger connection error', err instanceof Error ? err : undefined);
    } finally {
      setConnecting(false);
    }
  };

  const connectTrezor = async () => {
    setConnecting(true);
    setError('');
    
    try {
      await trezorService.initialize();
      
      // Get Ethereum address by default
      const addr = await trezorService.getEthereumAddress();
      
      setAddress(addr);
      setConnected(true);
      setSelectedWallet('trezor');
      
      alert('Trezor connected successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Trezor');
      logger.error('Trezor connection error', err instanceof Error ? err : undefined);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (selectedWallet === 'ledger') {
      await ledgerService.disconnect();
    }
    
    setConnected(false);
    setAddress('');
    setSelectedWallet(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Hardware Wallet</h2>

      {!connected ? (
        <div className="space-y-4">
          <p className="text-gray-600 mb-6">
            Connect your hardware wallet for maximum security. Your private keys never leave the device.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ledger Card */}
            <button
              onClick={connectLedger}
              disabled={connecting}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🔐</div>
                <h3 className="text-lg font-semibold mb-2">Ledger</h3>
                <p className="text-sm text-gray-600">
                  Connect via USB
                </p>
              </div>
            </button>

            {/* Trezor Card */}
            <button
              onClick={connectTrezor}
              disabled={connecting}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🛡️</div>
                <h3 className="text-lg font-semibold mb-2">Trezor</h3>
                <p className="text-sm text-gray-600">
                  Connect via USB
                </p>
              </div>
            </button>
          </div>

          {connecting && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">Connecting to device...</p>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-semibold text-blue-900 mb-2">Requirements:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Device must be connected via USB</li>
              <li>• Device must be unlocked</li>
              <li>• Ethereum app must be open (for Ledger)</li>
              <li>• Use Chrome, Edge, or Opera browser</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-green-900">
                  {selectedWallet === 'ledger' ? 'Ledger' : 'Trezor'} Connected
                </h3>
                <p className="text-sm text-green-700">Hardware wallet is ready to use</p>
              </div>
              <span className="text-3xl">
                {selectedWallet === 'ledger' ? '🔐' : '🛡️'}
              </span>
            </div>

            <div className="bg-white rounded p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Address:</p>
              <p className="font-mono text-sm break-all">{address}</p>
            </div>

            <button
              onClick={disconnect}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Disconnect
            </button>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <h4 className="font-semibold mb-2">Next Steps:</h4>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✓ You can now use this wallet for transactions</li>
              <li>✓ Sign transactions securely on your device</li>
              <li>✓ Private keys never leave the hardware wallet</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

