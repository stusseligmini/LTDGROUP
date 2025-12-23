export interface RecoveryManifest {
  version: number; // increment when structure changes
  createdAt: string; // ISO timestamp
  chain: 'solana' | 'ethereum' | 'polygon' | string;
  walletAddress: string;
  // Encrypted seed or key material; format depends on chain/implementation
  encryptedSeed?: string;
  encryptionMethod?: 'aes-gcm' | 'libsodium' | string;
  // Optional username bound to this wallet for easier restoration UX
  username?: string;
  // Guardians or recovery contacts (if social recovery is enabled)
  guardians?: Array<{
    contact: string; // email/phone/telegram handle
    publicKey?: string; // when applicable
  }>;
  // Additional metadata helpful during restore
  metadata?: Record<string, unknown>;
}

export type RecoveryManifestV1 = RecoveryManifest;

// Backup file shape used by backup service and restore API
export interface BackupFile {
  metadata: {
    walletId: string;
    walletName: string;
    blockchain: string;
    address: string;
    createdAt: string | Date;
    version: '1.0';
    encryptionMethod: 'AES-256-GCM';
  };
  encryptedData: string;
  salt: string; // PBKDF2 salt (hex)
  iv: string; // AES-GCM IV (base64/hex depending on implementation)
  checksum: string; // SHA-256 hex
}