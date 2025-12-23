/**
 * Privacy Policy Page
 * Required for MoonPay integration and app store compliance
 */

import { Card } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="container max-w-4xl py-12">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: December 5, 2025</p>

      <Card className="p-8 prose prose-slate dark:prose-invert max-w-none">
        <h2>1. Introduction</h2>
        <p>
          Welcome to Celora (we, our, or us). We are committed to protecting your privacy 
          and providing a secure, non-custodial wallet experience. This Privacy Policy explains 
          how we collect, use, and protect your information when you use our wallet services.
        </p>

        <h2>2. Non-Custodial Nature</h2>
        <p>
          <strong>Important:</strong> Celora is a non-custodial wallet. This means:
        </p>
        <ul>
          <li>We never have access to your private keys or seed phrases</li>
          <li>We cannot access, freeze, or recover your funds</li>
          <li>You are solely responsible for securing your wallet credentials</li>
          <li>All cryptographic operations occur on your device</li>
        </ul>

        <h2>3. Information We Collect</h2>
        
        <h3>3.1 Information You Provide</h3>
        <ul>
          <li><strong>Account Information:</strong> Email address, username (optional)</li>
          <li><strong>Public Wallet Addresses:</strong> Your blockchain addresses (public by nature)</li>
          <li><strong>Transaction Data:</strong> Public blockchain transaction history</li>
        </ul>

        <h3>3.2 Information We DO NOT Collect</h3>
        <ul>
          <li>Private keys or seed phrases</li>
          <li>Wallet passwords or PINs</li>
          <li>Banking or credit card information (handled by third parties)</li>
        </ul>

        <h3>3.3 Automatically Collected Information</h3>
        <ul>
          <li><strong>Usage Data:</strong> App interactions, features used, error logs</li>
          <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
          <li><strong>IP Address:</strong> For security and fraud prevention</li>
        </ul>

        <h2>4. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide and maintain wallet services</li>
          <li>Display your balance and transaction history</li>
          <li>Enable username-based transfers (@username feature)</li>
          <li>Improve app performance and user experience</li>
          <li>Detect and prevent fraud or security threats</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>5. Third-Party Services</h2>
        
        <h3>5.1 Firebase (Google)</h3>
        <p>We use Firebase for:</p>
        <ul>
          <li>Authentication (email/password)</li>
          <li>Database storage (public data only)</li>
          <li>Analytics and crash reporting</li>
        </ul>
        <p>
          Firebase&apos;s privacy policy:{' '}
          <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">
            https://firebase.google.com/support/privacy
          </a>
        </p>

        <h3>5.2 Stripe</h3>
        <p>
          When you purchase cryptocurrency, Stripe handles all payment processing and KYC verification. 
          Stripe is an independent service with its own privacy policy:{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            https://stripe.com/privacy
          </a>
        </p>

        <h3>5.3 Blockchain Networks</h3>
        <p>
          All transactions are recorded on public blockchains (Solana, Ethereum, etc.). 
          This data is permanently public and cannot be deleted.
        </p>

        <h2>6. Data Storage and Security</h2>
        <ul>
          <li><strong>Client-Side Storage:</strong> Private keys are encrypted and stored locally on your device</li>
          <li><strong>Server Storage:</strong> Only public addresses, usernames, and transaction metadata</li>
          <li><strong>Encryption:</strong> All sensitive data is encrypted in transit (HTTPS/TLS)</li>
          <li><strong>Access Controls:</strong> Strict internal access controls to user data</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your account</li>
          <li>Export your data</li>
          <li>Opt out of analytics</li>
        </ul>
        <p>
          To exercise these rights, contact us at:{' '}
          <a href="mailto:privacy@celora.com">privacy@celora.com</a>
        </p>

        <h2>8. Contact Us</h2>
        <p>
          For privacy-related questions or concerns:
        </p>
        <ul>
          <li>Email: <a href="mailto:privacy@celora.com">privacy@celora.com</a></li>
          <li>Telegram: <a href="https://t.me/celorawallet" target="_blank" rel="noopener noreferrer">@celorawallet</a></li>
        </ul>
      </Card>
    </div>
  );
}
