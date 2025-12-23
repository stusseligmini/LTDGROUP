"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Download, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateVsImportChoiceProps {
  onBack?: () => void;
}

export function CreateVsImportChoice({ onBack }: CreateVsImportChoiceProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="max-w-2xl w-full bg-slate-800/50 border-slate-700 backdrop-blur">
        <CardHeader className="text-center relative">
          {onBack && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className="absolute left-4 top-4 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <CardTitle className="text-3xl font-bold text-shadow-neon-duo pt-4">
            Set Up Your Wallet
          </CardTitle>
          <CardDescription className="text-slate-300">
            Choose how you&apos;d like to get started
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Card 
            className="border-2 border-slate-600 hover:border-cyan-primary/60 transition-all cursor-pointer bg-slate-700/30 hover:shadow-neon-sm"
            onClick={() => router.push('/wallet/create')}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-primary/20 to-purple-accent/20 flex items-center justify-center">
                  <PlusCircle className="w-7 h-7 text-cyan-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Create New Wallet</CardTitle>
                  <CardDescription className="text-slate-400">
                    Generate a new 12-word seed phrase
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary"></div>
                  Recommended for first-time users
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary"></div>
                  Takes less than 1 minute
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-primary"></div>
                  You&apos;ll receive a secure backup phrase
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card 
            className="border-2 border-slate-600 hover:border-purple-accent/60 transition-all cursor-pointer bg-slate-700/30 hover:shadow-neon-purple-sm"
            onClick={() => router.push('/wallet/import')}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-accent/20 to-cyan-primary/20 flex items-center justify-center">
                  <Download className="w-7 h-7 text-purple-accent" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">Import Existing Wallet</CardTitle>
                  <CardDescription className="text-slate-400">
                    Use your 12 or 24-word seed phrase
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-accent"></div>
                  Already have a wallet? Import it here
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-accent"></div>
                  Works with Phantom, Solflare, and others
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-accent"></div>
                  Your seed phrase never leaves your device
                </li>
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-400 text-center pt-4">
             Celora never stores your seed phrase. It stays encrypted on your device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
