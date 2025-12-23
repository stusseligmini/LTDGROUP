"use client";

import { useState } from 'react';
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import { CreateVsImportChoice } from '@/components/onboarding/CreateVsImportChoice';

type OnboardingStep = 'welcome' | 'choice' | 'pin-setup';

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('welcome');

  if (step === 'welcome') {
    return <WelcomeScreen onContinue={() => setStep('choice')} />;
  }

  if (step === 'choice') {
    return <CreateVsImportChoice onBack={() => setStep('welcome')} />;
  }

  // PIN setup will be handled in wallet creation flow
  return null;
}
