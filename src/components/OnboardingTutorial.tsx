'use client';

import React, { useState, useEffect } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const ONBOARDING_KEY = 'celora_onboarding_completed';

export default function OnboardingTutorial() {
  const [driverObj, setDriverObj] = useState<Driver | null>(null);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem(ONBOARDING_KEY);
    
    const steps: DriveStep[] = [
      {
        element: 'body',
        popover: {
          title: 'Welcome to Celora! 🎉',
          description: "Let's take a quick tour of your new crypto wallet. This will only take a minute!",
          side: 'over',
          align: 'center'
        }
      },
      {
        element: '[data-tour="wallet-balance"]',
        popover: {
          title: 'Your Wallet Balance',
          description: 'Here you can see your total balance across all blockchains and assets.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-tour="send-button"]',
        popover: {
          title: 'Send Crypto',
          description: 'Click here to send cryptocurrency to any wallet address. You can also scan QR codes!',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-tour="cards-section"]',
        popover: {
          title: 'Virtual Cards',
          description: 'Create virtual debit cards linked to your crypto. Spend anywhere that accepts cards!',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '[data-tour="nfts-link"]',
        popover: {
          title: 'NFT Gallery',
          description: 'View all your NFTs across different blockchains in one beautiful gallery.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-tour="defi-link"]',
        popover: {
          title: 'DeFi Features',
          description: 'Stake your assets, swap tokens, and earn rewards - all in one place.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '[data-tour="settings"]',
        popover: {
          title: 'Settings & Security',
          description: 'Configure your wallet, set spending limits, add guardians for social recovery, and more.',
          side: 'left',
          align: 'start'
        }
      },
      {
        element: 'body',
        popover: {
          title: "You're All Set! 🚀",
          description: `
            <p class="mb-4">You're ready to start using Celora. Here are some next steps:</p>
            <ul class="list-disc list-inside space-y-2">
              <li>Fund your wallet with crypto</li>
              <li>Create your first virtual card</li>
              <li>Set up social recovery guardians</li>
              <li>Explore DeFi opportunities</li>
            </ul>
          `,
          side: 'over',
          align: 'center'
        }
      }
    ];

    const driverInstance = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps,
      onDestroyed: () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      },
      onDestroyStarted: () => {
        if (driverInstance.hasNextStep() || driverInstance.hasPreviousStep()) {
          localStorage.setItem(ONBOARDING_KEY, 'true');
        }
      },
    });

    setDriverObj(driverInstance);

    if (!completed) {
      // Wait a bit before starting
      setTimeout(() => {
        driverInstance.drive();
      }, 1000);
    }

    return () => {
      driverInstance.destroy();
    };
  }, []);

  const handleRestart = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    if (driverObj) {
      driverObj.drive();
    }
  };

  return (
    <>
      {/* Help Button to Restart Tour */}
      <button
        onClick={handleRestart}
        className="fixed bottom-4 right-4 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-50"
        title="Restart Tutorial"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </>
  );
}

