"use client";

import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeliusTransaction } from '@/lib/solana/heliusApi';

interface TransactionHistoryItemProps {
  tx: HeliusTransaction;
  userAddress: string;
  parsed: {
    type: 'deposit' | 'withdrawal' | 'win' | 'loss' | 'transfer' | 'unknown';
    amount: number;
    counterparty: string | null;
    label: string;
    isCasinoTx: boolean;
  };
}

export function TransactionHistoryItem({ tx, userAddress, parsed }: TransactionHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getIcon = () => {
    switch (parsed.type) {
      case 'deposit':
      case 'withdrawal':
        return <ArrowUpRight className="w-5 h-5 text-red-400" />;
      case 'win':
      case 'transfer':
        return <ArrowDownRight className="w-5 h-5 text-green-400" />;
      default:
        return <Repeat className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = () => {
    if (tx.signatureInfo?.err) return 'text-red-400';
    switch (parsed.type) {
      case 'win':
        return 'text-green-400';
      case 'deposit':
      case 'withdrawal':
        return 'text-orange-400';
      default:
        return 'text-slate-300';
    }
  };

  const hasEvents = tx.events && (tx.events.nft || tx.events.swap || tx.events.compressed);
  const hasTokenTransfers = tx.tokenTransfers && tx.tokenTransfers.length > 0;

  return (
    <div className="border border-slate-700 rounded-lg p-4 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={`font-semibold ${getStatusColor()}`}>{parsed.label}</h4>
              <span className="text-sm text-slate-400">{formatDate(tx.timestamp)}</span>
            </div>
            <p className="text-sm text-slate-400 truncate">
              {parsed.counterparty ? `${parsed.counterparty.slice(0, 4)}...${parsed.counterparty.slice(-4)}` : 'Unknown'}
            </p>
            {hasEvents && (
              <div className="flex gap-2 mt-1">
                {tx.events?.nft && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">NFT</span>
                )}
                {tx.events?.swap && (
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-primary/20 text-cyan-primary">Swap</span>
                )}
                {tx.events?.compressed && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">cNFT</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className={`font-semibold ${getStatusColor()}`}>
              {parsed.type === 'withdrawal' || parsed.type === 'deposit' ? '-' : '+'}
              {parsed.amount.toFixed(4)} SOL
            </div>
            <div className="text-xs text-slate-500">
              Fee: {(tx.fee / 1e9).toFixed(6)} SOL
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Type:</span>
              <span className="ml-2 text-slate-300">{tx.type}</span>
            </div>
            <div>
              <span className="text-slate-500">Source:</span>
              <span className="ml-2 text-slate-300">{tx.source || 'Unknown'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">Signature:</span>
              <a
                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-cyan-primary hover:underline inline-flex items-center gap-1"
              >
                {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {hasTokenTransfers && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-400">Token Transfers:</h5>
              {tx.tokenTransfers!.map((transfer, idx) => (
                <div key={idx} className="text-xs bg-slate-700/30 rounded p-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="text-slate-300">{transfer.tokenAmount} {transfer.tokenSymbol || 'tokens'}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">Mint:</span>
                    <span className="text-slate-300 truncate ml-2">{transfer.mint.slice(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tx.signatureInfo?.memo && (
            <div>
              <span className="text-xs text-slate-500">Memo:</span>
              <p className="text-xs text-slate-300 mt-1 break-all">{tx.signatureInfo.memo}</p>
            </div>
          )}

          {tx.signatureInfo?.err && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
              <span className="text-xs text-red-400">Transaction Failed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
