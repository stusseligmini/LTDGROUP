import { RecoveryManifest } from '../types/backup';

export function createRecoveryManifest(params: {
  chain: string;
  walletAddress: string;
  encryptedSeed?: string;
  encryptionMethod?: string;
  username?: string;
  guardians?: Array<{ contact: string; publicKey?: string }>;
  metadata?: Record<string, unknown>;
}): RecoveryManifest {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    chain: params.chain,
    walletAddress: params.walletAddress,
    encryptedSeed: params.encryptedSeed,
    encryptionMethod: params.encryptionMethod,
    username: params.username,
    guardians: params.guardians,
    metadata: params.metadata,
  };
}

export function downloadManifest(manifest: RecoveryManifest, filename = 'recovery-manifest.json') {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readManifestFile(file: File): Promise<RecoveryManifest> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Invalid manifest');
  return data as RecoveryManifest;
}