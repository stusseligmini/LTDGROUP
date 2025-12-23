'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Upload, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';

interface BackupRecoveryProps {
  walletId: string;
  walletName: string;
  className?: string;
}

type BackupStep = 'menu' | 'create' | 'download' | 'verify' | 'restore' | 'success';

export function BackupRecovery({
  walletId,
  walletName,
  className,
}: BackupRecoveryProps) {
  const [step, setStep] = useState<BackupStep>('menu');
  const [createPassword, setCreatePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backupFile, setBackupFile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [agreedToWarnings, setAgreedToWarnings] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateBackup = async () => {
    if (!createPassword || createPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (createPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      // Call backend to create backup
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          walletName,
          password: createPassword,
        }),
      });

      if (!res.ok) throw new Error('Failed to create backup');
      const data = await res.json();
      setBackupFile(data.data?.backup);
      setStep('download');
    } catch (e: any) {
      setError(e.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      setError('Please select a backup file');
      return;
    }
    if (!restorePassword) {
      setError('Backup password is required');
      return;
    }
    if (!agreedToWarnings) {
      setError('Please acknowledge the warning before restoring');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const fileText = await restoreFile.text();
      const parsedBackup = JSON.parse(fileText);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backup: parsedBackup,
          password: restorePassword,
        }),
      });

      if (!res.ok) throw new Error('Failed to restore backup');
      const data = await res.json();

      setSuccessMessage('Wallet recovered successfully. Reload your wallet to finish.');
      // Optional: surface mnemonic if returned (avoid displaying by default for safety)
      if (data?.data?.mnemonic) {
        console.info('Backup restore returned mnemonic (not displayed for safety)');
      }
      setStep('success');
    } catch (e: any) {
      setError(e.message || 'Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    if (!backupFile) return;

    const json = JSON.stringify(backupFile, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `celora-backup-${walletName}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStep('verify');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // MENU STEP
  if (step === 'menu') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Wallet Backup & Recovery</CardTitle>
          <CardDescription>Secure your wallet with encrypted backups</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Important</p>
                <p>Keep backups safe and secure. Do not share with anyone. Do not store on unsecured devices.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={() => setStep('create')}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Create Encrypted Backup
            </Button>

            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setStep('restore')}
            >
              <Upload className="h-4 w-4" />
              Restore from Backup
            </Button>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Backup file: AES-256-GCM encrypted</p>
            <p>• Password protected with PBKDF2</p>
            <p>• Integrity verified with SHA-256</p>
            <p>• Can be stored securely online</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // CREATE BACKUP STEP
  if (step === 'create') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Create Encrypted Backup</CardTitle>
          <CardDescription>Set a strong password for your backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Backup Password</label>
            <Input
              type="password"
              placeholder="Enter strong password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              minLength={8}
            />
            <p className="text-xs text-gray-500">Minimum 8 characters. Use uppercase, numbers, symbols.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Confirm Password</label>
            <Input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
            />
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

          <div className="flex gap-2">
            <Button
              onClick={() => setStep('menu')}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBackup}
              disabled={loading || !createPassword || createPassword !== confirmPassword}
              className="flex-1 bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Backup'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // DOWNLOAD BACKUP STEP
  if (step === 'download' && backupFile) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Download Your Backup</CardTitle>
          <CardDescription>Save this file to a secure location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex gap-2 items-start">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold mb-1">Backup created successfully</p>
                <p>Your wallet is now encrypted and ready to backup.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Backup ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={backupFile.metadata?.walletId || ''}
                className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono text-gray-600"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(backupFile.metadata?.walletId || '')}
              >
                {copied ? 'Copied!' : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleDownloadBackup}
            className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Backup File
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Your backup is encrypted with AES-256-GCM. Even if stolen, it cannot be opened without your password.
          </p>
        </CardContent>
      </Card>
    );
  }

  // VERIFY BACKUP STEP
  if (step === 'verify') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Verify Your Backup</CardTitle>
          <CardDescription>Test recovery to ensure backup works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Next step: Test your backup by restoring it. This ensures the backup file is valid and can recover your wallet if needed.
            </p>
          </div>

          <Button
            onClick={() => setStep('restore')}
            className="w-full"
          >
            Verify Backup Now
          </Button>

          <Button
            onClick={() => setStep('menu')}
            variant="outline"
            className="w-full"
          >
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  // RESTORE BACKUP STEP
  if (step === 'restore') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Restore from Backup</CardTitle>
          <CardDescription>Recover wallet from encrypted backup file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Backup File</label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Backup Password</label>
            <Input
              type="password"
              placeholder="Enter backup password"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="agree"
              checked={agreedToWarnings}
              onChange={(e) => setAgreedToWarnings(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="agree" className="text-sm text-gray-600">
              I understand this will replace my current wallet configuration
            </label>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

          <div className="flex gap-2">
            <Button
              onClick={() => setStep('menu')}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              disabled={!agreedToWarnings || !restorePassword || !restoreFile || loading}
              className="flex-1"
              onClick={handleRestore}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Restoring...</> : 'Restore Wallet'}
            </Button>
          </div>

          {successMessage && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'success') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Recovery Successful</CardTitle>
          <CardDescription>Your wallet backup was restored.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-2 items-start">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-semibold mb-1">Wallet recovered</p>
              <p>Reload your wallet session to finalize the restore.</p>
            </div>
          </div>

          <Button onClick={() => setStep('menu')} className="w-full">Back to Backup Menu</Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
