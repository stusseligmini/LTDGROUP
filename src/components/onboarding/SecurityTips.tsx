"use client";

import { useState } from 'react';
import { X, Shield, Lock, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SecurityTipsProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export function SecurityTips({ isOpen, onClose, onAccept }: SecurityTipsProps) {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    setAccepted(true);
    if (onAccept) onAccept();
    setTimeout(() => onClose(), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="max-w-2xl w-full bg-slate-800 border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-2xl">Security Best Practices</CardTitle>
              <CardDescription>Protect your wallet and assets</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <SecurityTip
            icon={<Lock className="w-5 h-5" />}
            title="Never Share Your Seed Phrase"
            description="Your 12-word seed phrase is the master key to your wallet. Never share it with anyone, including support staff. Celora will NEVER ask for it."
            critical
          />

          <SecurityTip
            icon={<Eye className="w-5 h-5" />}
            title="Write Down Your Backup"
            description="Store your seed phrase offline on paper. Don&apos;t take screenshots or store it digitally. Keep multiple copies in secure locations."
          />

          <SecurityTip
            icon={<AlertTriangle className="w-5 h-5" />}
            title="Beware of Phishing"
            description="Always verify you're on the correct website. Check the URL carefully. Never click suspicious links or paste code into the console."
          />

          <SecurityTip
            icon={<Lock className="w-5 h-5" />}
            title="Use Strong Password"
            description="Your password encrypts your seed phrase locally. Use at least 12 characters with numbers, symbols, and mixed case."
          />

          <SecurityTip
            icon={<CheckCircle2 className="w-5 h-5" />}
            title="Non-Custodial = You're in Control"
            description="Celora never has access to your funds or seed phrase. This means YOU are responsible for your security and backups."
            highlight
          />

          <div className="pt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              I&apos;ll Read This Later
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1 bg-gradient-to-r from-cyan-primary to-purple-accent hover:shadow-neon-lg transition-all"
            >
              I Understand
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityTip({
  icon,
  title,
  description,
  critical,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  critical?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        critical
          ? 'bg-red-500/10 border border-red-500/30'
          : highlight
          ? 'bg-cyan-primary/10 border border-cyan-primary/30'
          : 'bg-slate-700/30 border border-slate-600/50'
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          critical
            ? 'bg-red-500/20 text-red-400'
            : highlight
            ? 'bg-cyan-primary/20 text-cyan-primary'
            : 'bg-slate-600/50 text-slate-300'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-slate-100 mb-1">{title}</h4>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
