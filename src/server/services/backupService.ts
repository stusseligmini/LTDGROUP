/**
 * Wallet Backup & Recovery System
 * - Encrypted seed phrase export
 * - Encrypted file backup
 * - Cloud backup (optional)
 * - Recovery from seed phrase
 * - Recovery from backup file
 */

import { encrypt, decrypt } from '@/lib/crypto/encryption';
import { logger } from '@/lib/logger';

export interface BackupMetadata {
  walletId: string;
  walletName: string;
  blockchain: string;
  address: string;
  createdAt: Date;
  version: '1.0';
  encryptionMethod: 'AES-256-GCM';
}

export interface BackupFile {
  metadata: BackupMetadata;
  encryptedData: string; // AES-256-GCM encrypted mnemonic
  salt: string; // PBKDF2 salt
  iv: string; // Initialization vector
  checksum: string; // SHA-256 for integrity
}

export class BackupService {
  /**
   * Create encrypted backup file for wallet
   * Output: JSON file safe to store offline
   */
  async createBackupFile(
    walletId: string,
    walletName: string,
    blockchain: string,
    address: string,
    mnemonic: string,
    password: string
  ): Promise<BackupFile> {
    try {
      // Generate random salt for key derivation
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const saltHex = Array.from(salt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Encrypt mnemonic with password
      const { encrypted, iv } = await encrypt(mnemonic, password, salt);

      // Create checksum for integrity verification
      const checksumData = `${walletId}${address}${encrypted}`;
      const checksumBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checksumData));
      const checksum = Array.from(new Uint8Array(checksumBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const backup: BackupFile = {
        metadata: {
          walletId,
          walletName,
          blockchain,
          address,
          createdAt: new Date(),
          version: '1.0',
          encryptionMethod: 'AES-256-GCM',
        },
        encryptedData: encrypted,
        salt: saltHex,
        iv,
        checksum,
      };

      logger.info('Backup file created', { walletId, blockchain });
      return backup;
    } catch (error) {
      logger.error('Error creating backup file', error);
      throw new Error('Failed to create backup file');
    }
  }

  /**
   * Restore wallet from encrypted backup file
   * Input: BackupFile + password
   * Output: Restored mnemonic
   */
  async restoreFromBackupFile(
    backup: BackupFile,
    password: string
  ): Promise<{ mnemonic: string; address: string; wallet: any }> {
    try {
      // Verify checksum
      const checksumData = `${backup.metadata.walletId}${backup.metadata.address}${backup.encryptedData}`;
      const checksumBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checksumData));
      const expectedChecksum = Array.from(new Uint8Array(checksumBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (expectedChecksum !== backup.checksum) {
        throw new Error('Backup file corrupted - checksum mismatch');
      }

      // Convert salt back to Uint8Array
      const saltHex = backup.salt;
      const salt = new Uint8Array(
        (saltHex.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
      );

      // Decrypt mnemonic
      const mnemonic = await decrypt(
        backup.encryptedData,
        password,
        salt,
        backup.iv
      );

      // Validate mnemonic format
      const mnemonicWords = mnemonic.trim().split(/\s+/);
      if (![12, 15, 18, 21, 24].includes(mnemonicWords.length)) {
        throw new Error('Invalid mnemonic length after decryption');
      }

      // Derive wallet from mnemonic
      const { deriveSolanaWallet } = await import('@/lib/solana/solanaWallet');
      const wallet = await deriveSolanaWallet(mnemonic, 0);

      // Verify address matches
      if (wallet.address !== backup.metadata.address) {
        throw new Error('Recovered address does not match backup address');
      }

      logger.info('Wallet restored from backup', { address: backup.metadata.address });

      return {
        mnemonic,
        address: wallet.address,
        wallet,
      };
    } catch (error) {
      logger.error('Error restoring from backup file', error);
      throw error;
    }
  }

  /**
   * Export backup as JSON file for download
   */
  async exportBackupAsJson(backup: BackupFile): Promise<string> {
    try {
      const json = JSON.stringify(backup, null, 2);
      return json;
    } catch (error) {
      logger.error('Error exporting backup', error);
      throw new Error('Failed to export backup');
    }
  }

  /**
   * Import backup from JSON file
   */
  async importBackupFromJson(jsonString: string): Promise<BackupFile> {
    try {
      const backup = JSON.parse(jsonString) as BackupFile;

      // Validate backup structure
      if (!backup.metadata || !backup.encryptedData || !backup.salt || !backup.iv) {
        throw new Error('Invalid backup file format');
      }

      return backup;
    } catch (error) {
      logger.error('Error importing backup', error);
      throw new Error('Invalid backup file format');
    }
  }

  /**
   * Create seed phrase backup with printed QR code
   */
  async createSeedPhraseBackup(
    mnemonic: string,
    walletName: string
  ): Promise<{
    seedPhrase: string[];
    encryptedPhrase: string;
    instructions: string[];
  }> {
    try {
      const seedPhrase = mnemonic.split(/\s+/);

      // Instructions for user
      const instructions = [
        '1. Write down the seed phrase in order',
        '2. Store in secure location (safe, vault)',
        '3. Never share with anyone',
        '4. Do not screenshot or take photos',
        '5. Do not type into computer',
        '6. Keep separate from backup files',
      ];

      // Optional: Create encrypted version with passphrase
      const encryptionSalt = crypto.getRandomValues(new Uint8Array(32));
      const encryptionSaltHex = Array.from(encryptionSalt)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Encrypt with default encryption for storage
      const { encrypted } = await encrypt(mnemonic, walletName, encryptionSalt);

      logger.info('Seed phrase backup created', { walletName });

      return {
        seedPhrase,
        encryptedPhrase: encrypted,
        instructions,
      };
    } catch (error) {
      logger.error('Error creating seed phrase backup', error);
      throw new Error('Failed to create seed phrase backup');
    }
  }

  /**
   * Verify backup integrity and recovery possibility
   */
  async verifyBackup(
    backup: BackupFile,
    testPassword: string
  ): Promise<{
    isValid: boolean;
    checksumMatch: boolean;
    canRecover: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      // Check checksum
      const checksumData = `${backup.metadata.walletId}${backup.metadata.address}${backup.encryptedData}`;
      const checksumBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checksumData));
      const expectedChecksum = Array.from(new Uint8Array(checksumBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const checksumMatch = expectedChecksum === backup.checksum;

      // Check metadata
      if (!backup.metadata.version) warnings.push('No version info');
      if (!backup.metadata.createdAt) warnings.push('No creation date');
      if (!backup.metadata.address) warnings.push('No address info');

      // Try to decrypt (don't throw, just check possibility)
      let canRecover = false;
      try {
        const saltHex = backup.salt;
        const salt = new Uint8Array(
          (saltHex.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
        );

        await decrypt(
          backup.encryptedData,
          testPassword,
          salt,
          backup.iv
        );
        canRecover = true;
      } catch (e) {
        warnings.push('Cannot decrypt with provided password');
      }

      return {
        isValid: checksumMatch && warnings.length === 0,
        checksumMatch,
        canRecover,
        warnings,
      };
    } catch (error) {
      logger.error('Error verifying backup', error);
      return {
        isValid: false,
        checksumMatch: false,
        canRecover: false,
        warnings: ['Backup verification failed'],
      };
    }
  }

  /**
   * Export backup for cloud storage (encrypted)
   * Suitable for: Google Drive, Dropbox, iCloud
   */
  async prepareForCloudStorage(
    backup: BackupFile,
    cloudPassword: string
  ): Promise<{
    cloudData: string;
    metadata: BackupMetadata;
    recoveryCode: string;
  }> {
    try {
      // Create recovery code (short identifier)
      const recoveryCode = `${backup.metadata.walletId.substring(0, 8)}-${backup.metadata.address.substring(0, 8)}`;

      // Encrypt entire backup with cloud password
      const backupJson = JSON.stringify(backup);
      const cloudSalt = crypto.getRandomValues(new Uint8Array(32));
      const { encrypted } = await encrypt(backupJson, cloudPassword, cloudSalt);

      return {
        cloudData: encrypted,
        metadata: backup.metadata,
        recoveryCode,
      };
    } catch (error) {
      logger.error('Error preparing backup for cloud storage', error);
      throw new Error('Failed to prepare backup for cloud');
    }
  }

  /**
   * Recovery from cloud storage
   */
  async recoverFromCloudStorage(
    encryptedData: string,
    cloudPassword: string,
    salt: string,
    iv: string
  ): Promise<BackupFile> {
    try {
      const saltBytes = new Uint8Array(
        (salt.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
      );

      const backupJson = await decrypt(
        encryptedData,
        cloudPassword,
        saltBytes,
        iv
      );

      const backup = JSON.parse(backupJson) as BackupFile;
      return backup;
    } catch (error) {
      logger.error('Error recovering from cloud storage', error);
      throw new Error('Failed to recover backup from cloud');
    }
  }
}

export default new BackupService();
