"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Wallet, Zap, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="max-w-2xl w-full bg-slate-800/50 border-slate-700 backdrop-blur">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-primary to-purple-accent rounded-full flex items-center justify-center shadow-neon">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-4xl font-bold text-shadow-neon-duo">
            Welcome to Celora
          </CardTitle>
          <CardDescription className="text-lg text-slate-300">
            Your non-custodial Solana wallet for gambling and beyond
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="100% Non-Custodial"
              description="You own your keys. We never see your seed phrase."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Lightning Fast"
              description="Send to @username instantly. Swap tokens in seconds."
            />
            <FeatureCard
              icon={<Wallet className="w-6 h-6" />}
              title="Gambler-Friendly"
              description="Quick deposits to casinos. Virtual cards. Price tracking."
            />
          </div>

          <div className="pt-4">
            <Button 
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-cyan-primary to-purple-accent hover:shadow-neon-lg transition-all duration-300 text-white font-semibold py-6 text-lg"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-700/30 border border-slate-600/50 hover:border-cyan-primary/50 transition-colors">
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-primary/20 to-purple-accent/20 flex items-center justify-center text-cyan-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-slate-100 mb-1">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
