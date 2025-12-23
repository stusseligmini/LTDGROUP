/**
 * Terms of Service Page
 * Required for MoonPay integration and app store compliance
 */

import { Card } from '@/components/ui/card';

export default function TermsPage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

      <Card className="p-8 prose prose-slate dark:prose-invert max-w-none">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Celora (the Service), you agree to be bound by these Terms of Service. 
          If you do not agree to these Terms, do not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          Celora is a <strong>non-custodial cryptocurrency wallet</strong> that allows you to:
        </p>
        <ul>
          <li>Store, send, and receive digital assets on supported blockchains (Solana, Ethereum, etc.)</li>
          <li>Purchase cryptocurrency via third-party providers (Stripe)</li>
          <li>Access decentralized finance (DeFi) protocols</li>
          <li>Use username-based transfers (@username)</li>
        </ul>

        <h2>3. Non-Custodial Wallet - Important Disclaimer</h2>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-lg not-prose">
          <p className="font-bold text-amber-900 dark:text-amber-200 mb-2">CRITICAL: READ CAREFULLY</p>
          <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <li>• Celora is a <strong>non-custodial</strong> wallet. We do NOT have access to your private keys or funds.</li>
            <li>• You are <strong>solely responsible</strong> for securing your seed phrase, private keys, and passwords.</li>
            <li>• If you lose your seed phrase, <strong>your funds are permanently lost</strong>. We cannot recover them.</li>
            <li>• We are NOT a bank, financial institution, or money transmitter.</li>
            <li>• We do NOT custody, store, send, or receive funds on your behalf.</li>
          </ul>
        </div>

        <h2>4. Eligibility</h2>
        <p>You must:</p>
        <ul>
          <li>Be at least 18 years old</li>
          <li>Have the legal capacity to enter into contracts</li>
          <li>Not be located in a prohibited jurisdiction</li>
          <li>Comply with all applicable laws regarding cryptocurrency use in your jurisdiction</li>
        </ul>

        <h2>5. User Responsibilities</h2>
        
        <h3>5.1 Security</h3>
        <p>You are responsible for:</p>
        <ul>
          <li>Keeping your seed phrase and passwords confidential</li>
          <li>Never sharing your private keys with anyone (including Celora staff)</li>
          <li>Using strong, unique passwords</li>
          <li>Securing your device from malware and unauthorized access</li>
        </ul>

        <h3>5.2 Prohibited Activities</h3>
        <p>You may NOT use Celora to:</p>
        <ul>
          <li>Engage in illegal activities (money laundering, terrorism financing, fraud)</li>
          <li>Violate sanctions or export control laws</li>
          <li>Transmit malware or harmful code</li>
          <li>Impersonate others or create fake accounts</li>
        </ul>

        <h2>6. Third-Party Services</h2>
        
        <h3>6.1 Stripe</h3>
        <p>
          Cryptocurrency purchases are processed by Stripe, an independent third party. 
          Stripe&apos;s terms apply to all purchases:{' '}
          <a href="https://stripe.com/legal/end-users" target="_blank" rel="noopener noreferrer">
            https://stripe.com/legal/end-users
          </a>
        </p>

        <h3>6.2 Blockchain Networks</h3>
        <p>
          Transactions occur on public blockchains (Solana, Ethereum, etc.). We do NOT control these networks and are 
          NOT responsible for network delays, failures, or fees.
        </p>

        <h2>7. Disclaimers and Limitation of Liability</h2>
        
        <h3>7.1 No Warranties</h3>
        <p>
          The Service is provided as-is and as-available without warranties of any kind.
        </p>

        <h3>7.2 Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CELORA SHALL NOT BE LIABLE FOR:
        </p>
        <ul>
          <li>Loss of funds due to forgotten passwords, lost seed phrases, or device loss</li>
          <li>Blockchain network failures, delays, or congestion</li>
          <li>Third-party service failures (Stripe, RPC providers, etc.)</li>
          <li>Smart contract bugs, exploits, or hacks</li>
          <li>Price volatility or market losses</li>
        </ul>

        <h2>8. Regulatory Compliance</h2>
        <p>
          Cryptocurrency regulations vary by jurisdiction. You are responsible for:
        </p>
        <ul>
          <li>Understanding and complying with your local laws</li>
          <li>Paying applicable taxes on cryptocurrency transactions</li>
          <li>Reporting income, gains, or losses as required by law</li>
        </ul>

        <h2>9. Contact Information</h2>
        <p>
          For questions about these Terms:
        </p>
        <ul>
          <li>Email: <a href="mailto:legal@celora.com">legal@celora.com</a></li>
          <li>Telegram: <a href="https://t.me/celorawallet" target="_blank" rel="noopener noreferrer">@celorawallet</a></li>
        </ul>

        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-lg mt-8 not-prose">
          <p className="font-bold mb-2">Acknowledgment</p>
          <p className="text-sm">
            By using Celora, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. 
            You understand that cryptocurrency transactions are irreversible and that you are solely responsible for 
            securing your wallet credentials.
          </p>
        </div>
      </Card>
    </div>
  );
}
