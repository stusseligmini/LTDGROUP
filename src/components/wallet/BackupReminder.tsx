"use client";

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface BackupReminderProps {
  walletId: string;
  onDismiss?: () => void;
}

const REMINDER_KEY = 'backup-reminder-dismissed';
const SNOOZE_KEY = 'backup-reminder-snoozed';
const SNOOZE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function BackupReminder({ walletId, onDismiss }: BackupReminderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkVisibility = () => {
      // Check if permanently dismissed
      const dismissedWallets = JSON.parse(localStorage.getItem(REMINDER_KEY) || '[]');
      if (dismissedWallets.includes(walletId)) {
        setIsVisible(false);
        return;
      }

      // Check if snoozed
      const snoozeData = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
      const snoozeUntil = snoozeData[walletId];
      if (snoozeUntil && Date.now() < snoozeUntil) {
        setIsVisible(false);
        return;
      }

      setIsVisible(true);
    };

    checkVisibility();
  }, [walletId]);

  const handleBackupNow = () => {
    router.push('/wallet/backup');
    handleDismiss();
  };

  const handleSnooze = () => {
    const snoozeData = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
    snoozeData[walletId] = Date.now() + SNOOZE_DURATION;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozeData));
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  const handleDismiss = () => {
    const dismissedWallets = JSON.parse(localStorage.getItem(REMINDER_KEY) || '[]');
    if (!dismissedWallets.includes(walletId)) {
      dismissedWallets.push(walletId);
      localStorage.setItem(REMINDER_KEY, JSON.stringify(dismissedWallets));
    }
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="w-96 border-orange-500/50 bg-slate-800/95 backdrop-blur shadow-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-slate-100">Backup Your Wallet</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Protect your funds by backing up your recovery phrase. Without it, you could lose access forever.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  className="flex-shrink-0 -mt-1 -mr-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleBackupNow}
                  size="sm"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Backup Now
                </Button>
                <Button
                  onClick={handleSnooze}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Remind Later
                </Button>
              </div>

              <p className="text-xs text-slate-500 pt-1">
                This reminder will persist until you back up your wallet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
