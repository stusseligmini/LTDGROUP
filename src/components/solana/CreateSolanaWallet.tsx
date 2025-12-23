'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { 
  generateMnemonicPhrase, 
  deriveWallet, 
  hashMnemonic,
  WalletEncryption,
  storeWalletLocally,
  type WalletKey 
} from '@/lib/wallet/nonCustodialWallet';
import { deriveSolanaWallet } from '@/lib/solana/solanaWallet';
import { setWalletPin } from '@/lib/wallet/pinManagement';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';

type Step = 'generate' | 'backup' | 'verify' | 'password' | 'pin-setup' | 'complete';

interface PasswordStrength {
  score: number; // 0-4 (0=weak, 4=very strong)
  feedback: string;
}

/**
 * Calculate password strength
 */
function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, feedback: 'Enter a password' };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;

  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else if (password.length > 0) feedback.push('Use both uppercase and lowercase letters');

  if (/\d/.test(password)) score += 1;
  else if (password.length > 0) feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else if (password.length > 0) feedback.push('Add special characters (!@#$%^&*)');

  // Strength labels
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Very Strong'];
  const strengthColors = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-green-600', 'text-green-700'];

  return {
    score: Math.min(score, 4),
    feedback: feedback.length > 0 ? feedback.join('. ') : strengthLabels[score],
  };
}

/**
 * Calculate PIN strength (4-8 digits)
 */
function calculatePinStrength(pin: string): PasswordStrength {
  if (!pin) {
    return { score: 0, feedback: 'Enter a 4-8 digit PIN' };
  }

  if (!/^\d+$/.test(pin)) {
    return { score: 0, feedback: 'PIN must contain only digits' };
  }

  if (pin.length < 4) {
    return { score: 1, feedback: `Need ${4 - pin.length} more digits` };
  }

  let score = 2;
  const feedback: string[] = [];

  // Check for repeating patterns
  if (/^(\d)\1+$/.test(pin)) {
    return { score: 1, feedback: 'Avoid repeating digits (like 1111)' };
  }

  // Check for sequential patterns
  if (/(?:012|123|234|345|456|567|678|789|890|1234|2345|3456|4567|5678|6789)/.test(pin)) {
    score = 2;
    feedback.push('Avoid sequential numbers');
  }

  if (pin.length >= 6) score = 3;
  if (pin.length >= 8) score = 4;

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Very Strong'];
  return {
    score,
    feedback: feedback.length > 0 ? feedback.join('. ') : strengthLabels[score],
  };
}

export function CreateSolanaWallet() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [step, setStep] = useState<Step>('generate');
  const [mnemonic, setMnemonic] = useState<string>('');
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [revealMnemonic, setRevealMnemonic] = useState(false);
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({ score: 0, feedback: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [walletPublicKey, setWalletPublicKey] = useState<string>('');
  
  // PIN setup state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStrength, setPinStrength] = useState<PasswordStrength>({ score: 0, feedback: '' });
  const [pinError, setPinError] = useState<string | null>(null);
  
  // Verification state
  const [verificationWords, setVerificationWords] = useState<{ index: number; word: string }[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>(['', '', '']);
  const [verificationError, setVerificationError] = useState<string>('');

  // SECURITY: Cleanup sensitive data on unmount
  useEffect(() => {
    return () => {
      setMnemonic('');
      setPassword('');
      setConfirmPassword('');
      setPin('');
      setConfirmPin('');
      setUserAnswers(['', '', '']);
    };
  }, []);

  // Generate mnemonic on mount
  useEffect(() => {
    if (step === 'generate' && !mnemonic) {
      const newMnemonic = generateMnemonicPhrase(wordCount);
      setMnemonic(newMnemonic);
    }
  }, [step, wordCount, mnemonic]);

  // Calculate password strength
  useEffect(() => {
    if (step === 'password') {
      setPasswordStrength(calculatePasswordStrength(password));
    }
  }, [password, step]);

  // Calculate PIN strength
  useEffect(() => {
    if (step === 'pin-setup') {
      setPinStrength(calculatePinStrength(pin));
    }
  }, [pin, step]);

  // Generate new mnemonic
  const handleGenerateNew = () => {
    const newMnemonic = generateMnemonicPhrase(wordCount);
    setMnemonic(newMnemonic);
    setRevealMnemonic(false);
    setMnemonicConfirmed(false);
  };

  // Toggle word count (12/24)
  const handleToggleWordCount = () => {
    const newCount = wordCount === 12 ? 24 : 12;
    setWordCount(newCount);
    const newMnemonic = generateMnemonicPhrase(newCount);
    setMnemonic(newMnemonic);
    setRevealMnemonic(false);
    setMnemonicConfirmed(false);
  };

  // Copy mnemonic to clipboard
  const handleCopyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      // You could show a toast here
      alert('Mnemonic phrase copied to clipboard!');
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  // Proceed to backup step
  const handleProceedToBackup = () => {
    setStep('backup');
    setRevealMnemonic(true);
  };

  // Proceed to verification step
  const handleProceedToVerify = () => {
    if (!mnemonicConfirmed) {
      setError('Please confirm you have backed up your mnemonic phrase');
      return;
    }
    
    // Generate 3 random word positions to verify
    const words = mnemonic.split(' ');
    const positions: number[] = [];
    while (positions.length < 3) {
      const randomPos = Math.floor(Math.random() * words.length);
      if (!positions.includes(randomPos)) {
        positions.push(randomPos);
      }
    }
    
    const verifyWords = positions.sort((a, b) => a - b).map(pos => ({
      index: pos,
      word: words[pos]
    }));
    
    setVerificationWords(verifyWords);
    setUserAnswers(['', '', '']);
    setVerificationError('');
    setStep('verify');
  };
  
  // Verify seed phrase
  const handleVerifySeedPhrase = () => {
    const isCorrect = verificationWords.every((item, idx) => 
      userAnswers[idx].toLowerCase().trim() === item.word.toLowerCase()
    );
    
    if (!isCorrect) {
      setVerificationError('Incorrect words. Please check your recovery phrase and try again.');
      return;
    }
    
    setVerificationError('');
    setStep('password');
  };

  // Create wallet
  const handleCreateWallet = async () => {
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 2) {
      setError('Please use a stronger password');
      return;
    }

    if (!user) {
      setError('Please sign in to create a wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Derive Solana wallet from mnemonic
      const solanaWallet = await deriveSolanaWallet(mnemonic, 0);
      const publicKeyHex = Buffer.from(solanaWallet.publicKey.toBytes()).toString('hex');
      
      setWalletAddress(solanaWallet.address);
      setWalletPublicKey(publicKeyHex);

      // Step 2: Encrypt mnemonic with password
      const encryptionResult = await WalletEncryption.encrypt(mnemonic, password);

      // Step 3: Create wallet via API (no mnemonic/hash sent to server)
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blockchain: 'solana',
          address: solanaWallet.address,
          publicKey: publicKeyHex,
          label: 'My Solana Wallet',
          isDefault: true,
          derivationPath: "m/44'/501'/0'/0'",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create wallet');
      }

      const walletData = await response.json();

      // Step 5: Store encrypted mnemonic locally
      await storeWalletLocally(
        walletData.id,
        encryptionResult.encrypted,
        encryptionResult.salt,
        encryptionResult.iv,
        localStorage
      );

      // Step 6: Move to PIN setup
      setStep('pin-setup');
      
      // SECURITY: Clear sensitive data from memory
      setMnemonic('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
      console.error('Error creating wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup PIN
  const handleSetupPin = async () => {
    setPinError(null);

    if (!pin || !confirmPin) {
      setPinError('Please enter and confirm your PIN');
      return;
    }

    if (pin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      setPinError('PIN must contain only digits');
      return;
    }

    if (pin.length < 4 || pin.length > 8) {
      setPinError('PIN must be between 4 and 8 digits');
      return;
    }

    if (pinStrength.score < 2) {
      setPinError('Please use a stronger PIN');
      return;
    }

    setLoading(true);

    try {
      // Store PIN locally with encryption
      await setWalletPin(pin);

      // Clear PIN from memory
      setPin('');
      setConfirmPin('');

      // Move to complete step
      setStep('complete');
    } catch (err: any) {
      setPinError(err.message || 'Failed to setup PIN');
      console.error('Error setting up PIN:', err);
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'generate':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Generate Your Recovery Phrase</h3>
              <p className="text-gray-600">
                Your recovery phrase is used to restore your wallet. Keep it safe and never share it.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button
                variant={wordCount === 12 ? 'default' : 'outline'}
                onClick={() => setWordCount(12)}
              >
                12 Words
              </Button>
              <Button
                variant={wordCount === 24 ? 'default' : 'outline'}
                onClick={() => setWordCount(24)}
              >
                24 Words
              </Button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-sm text-gray-600 mb-4">
                A new {wordCount}-word recovery phrase has been generated. Click &quot;Generate New&quot; to create a different one.
              </p>
              <Button variant="outline" onClick={handleGenerateNew} className="w-full">
                Generate New Phrase
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToBackup}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Back Up Your Recovery Phrase</h3>
              <p className="text-gray-600">
                Write down these {wordCount} words in order and store them in a safe place. Never share them with anyone.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 font-semibold mb-1">⚠️ Security Warning</p>
              <p className="text-sm text-yellow-700">
                If you lose this phrase, you will lose access to your wallet forever. We cannot recover it for you.
              </p>
            </div>

            {revealMnemonic ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-6 rounded-lg border-2 border-gray-300">
                  <div className="grid grid-cols-2 gap-3">
                    {mnemonic.split(' ').map((word, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-white rounded border"
                      >
                        <span className="text-xs text-gray-500 w-6">{index + 1}.</span>
                        <span className="text-sm font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleCopyMnemonic}
                  className="w-full"
                >
                  Copy to Clipboard
                </Button>
              </div>
            ) : (
              <div className="bg-gray-100 p-8 rounded-lg text-center">
                <Button onClick={() => setRevealMnemonic(true)}>
                  Reveal Recovery Phrase
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mnemonicConfirmed}
                  onChange={(e) => setMnemonicConfirmed(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  I have written down my recovery phrase and stored it in a safe place
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('generate')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleProceedToVerify}
                disabled={!mnemonicConfirmed}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        );

      case 'verify':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Verify Your Recovery Phrase</h3>
              <p className="text-gray-600">
                To make sure you&apos;ve backed up your phrase correctly, please enter the words at the following positions:
              </p>
            </div>

            <div className="space-y-4">
              {verificationWords.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Word #{item.index + 1}
                  </label>
                  <Input
                    type="text"
                    value={userAnswers[idx]}
                    onChange={(e) => {
                      const newAnswers = [...userAnswers];
                      newAnswers[idx] = e.target.value;
                      setUserAnswers(newAnswers);
                      setVerificationError('');
                    }}
                    placeholder={`Enter word #${item.index + 1}`}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>

            {verificationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{verificationError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('backup');
                  setVerificationError('');
                  setUserAnswers(['', '', '']);
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleVerifySeedPhrase}
                disabled={userAnswers.some(answer => !answer.trim())}
                className="flex-1"
              >
                Verify & Continue
              </Button>
            </div>
          </div>
        );

      case 'password':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Set Your Password</h3>
              <p className="text-gray-600">
                This password encrypts your wallet locally. Choose a strong password you can remember.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full"
                />
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            passwordStrength.score === 0 ? 'bg-red-500 w-0'
                            : passwordStrength.score === 1 ? 'bg-red-500 w-1/4'
                            : passwordStrength.score === 2 ? 'bg-yellow-500 w-1/2'
                            : passwordStrength.score === 3 ? 'bg-green-500 w-3/4'
                            : 'bg-green-600 w-full'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        passwordStrength.score === 0 ? 'text-red-600'
                        : passwordStrength.score === 1 ? 'text-red-600'
                        : passwordStrength.score === 2 ? 'text-yellow-600'
                        : passwordStrength.score === 3 ? 'text-green-600'
                        : 'text-green-700'
                      }`}>
                        {passwordStrength.feedback}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-red-600 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('backup')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreateWallet}
                disabled={loading || !password || !confirmPassword || password !== confirmPassword || passwordStrength.score < 2}
                className="flex-1"
              >
                {loading ? 'Creating Wallet...' : 'Create Wallet'}
              </Button>
            </div>
          </div>
        );

      case 'pin-setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Set Your Wallet PIN</h3>
              <p className="text-gray-600">
                Create a 4-8 digit PIN to quickly unlock your wallet. This adds an extra layer of security.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 font-semibold mb-1">🔒 Security Note</p>
              <p className="text-sm text-blue-700">
                Your PIN is encrypted and stored locally. Never share it with anyone.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">PIN (4-8 digits)</label>
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setPin(value);
                  }}
                  placeholder="Enter 4-8 digits"
                  className="w-full text-lg tracking-widest"
                  maxLength={8}
                />
                {pin && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            pinStrength.score === 0 ? 'bg-red-500 w-0'
                            : pinStrength.score === 1 ? 'bg-red-500 w-1/4'
                            : pinStrength.score === 2 ? 'bg-yellow-500 w-1/2'
                            : pinStrength.score === 3 ? 'bg-green-500 w-3/4'
                            : 'bg-green-600 w-full'
                          }`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        pinStrength.score === 0 ? 'text-red-600'
                        : pinStrength.score === 1 ? 'text-red-600'
                        : pinStrength.score === 2 ? 'text-yellow-600'
                        : pinStrength.score === 3 ? 'text-green-600'
                        : 'text-green-700'
                      }`}>
                        {pinStrength.feedback}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm PIN</label>
                <Input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setConfirmPin(value);
                  }}
                  placeholder="Re-enter your PIN"
                  className="w-full text-lg tracking-widest"
                  maxLength={8}
                />
                {confirmPin && pin !== confirmPin && (
                  <p className="text-red-600 text-xs mt-1">PINs do not match</p>
                )}
              </div>
            </div>

            {pinError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{pinError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('password')}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleSetupPin}
                disabled={loading || !pin || !confirmPin || pin !== confirmPin || pinStrength.score < 2}
                className="flex-1"
              >
                {loading ? 'Setting PIN...' : 'Complete Setup'}
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6 text-center">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-semibold mb-2 text-green-800">Wallet Created Successfully!</h3>
              <p className="text-gray-600">
                Your Solana wallet is ready to use. Your recovery phrase is encrypted and stored locally.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Your Wallet Address</p>
              <p className="font-mono text-sm break-all bg-white p-2 rounded border">
                {walletAddress}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                  alert('Address copied to clipboard!');
                }}
                className="mt-2"
              >
                Copy Address
              </Button>
            </div>

            <Button
              onClick={() => router.push('/wallet')}
              className="w-full"
            >
              Go to Wallet Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Solana Wallet</CardTitle>
        <CardDescription>
          {step === 'generate' && 'Generate your recovery phrase'}
          {step === 'backup' && 'Back up your recovery phrase'}
          {step === 'verify' && 'Verify your recovery phrase'}
          {step === 'password' && 'Set your password'}
          {step === 'pin-setup' && 'Set your PIN'}
          {step === 'complete' && 'Wallet created successfully'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {['generate', 'backup', 'verify', 'password', 'pin-setup', 'complete'].map((s, index) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  ['generate', 'backup', 'verify', 'password', 'pin-setup', 'complete'].indexOf(step) >= index
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              {index < 5 && (
                <div
                  className={`w-12 h-1 ${
                    ['generate', 'backup', 'verify', 'password', 'pin-setup', 'complete'].indexOf(step) > index
                      ? 'bg-cyan-600'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {renderStepContent()}
      </CardContent>
    </Card>
  );
}

