import { Wallet as WalletModel } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { randomBytes } from 'crypto';
import { ethers, TransactionReceipt } from 'ethers';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/security/encryption';
import {
  getGuardianRegistryAddress,
  guardianRegistryInterface,
} from '@/lib/blockchain/contracts';
import { ethereumClient } from '@/lib/blockchain/ethereum';
import type { EthereumClient } from '@/lib/blockchain/ethereum';
import { polygonClient } from '@/lib/blockchain/polygon';
import { arbitrumClient } from '@/lib/blockchain/arbitrum';
import { optimismClient } from '@/lib/blockchain/optimism';
import { celoClient } from '@/lib/blockchain/celo';
type EvmChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'celo';

const evmClients: Record<EvmChain, EthereumClient> = {
  ethereum: ethereumClient,
  polygon: polygonClient,
  arbitrum: arbitrumClient,
  optimism: optimismClient,
  celo: celoClient,
};

export class RecoveryService {
  private isOnChainEnabled(): boolean {
    return process.env.SOCIAL_RECOVERY_ONCHAIN_ENABLED === 'true';
  }

  private isEvmChain(blockchain: string): blockchain is EvmChain {
    return Object.prototype.hasOwnProperty.call(
      evmClients,
      blockchain.toLowerCase()
    );
  }

  private getEvmClientOrThrow(blockchain: string): EthereumClient {
    if (!this.isEvmChain(blockchain)) {
      throw new Error(`Unsupported blockchain for recovery contracts: ${blockchain}`);
    }

    return evmClients[blockchain.toLowerCase() as EvmChain];
  }

  private canUseOnChain(blockchain: string): boolean {
    return this.isOnChainEnabled() && this.isEvmChain(blockchain);
  }

  private normalizeAddress(address: string): string {
    return ethers.getAddress(address);
  }

  private async getUserWalletForChain(
    userId: string,
    blockchain: string
  ): Promise<WalletModel | null> {
    return prisma.wallet.findFirst({
      where: {
        userId,
        blockchain,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  private async getGuardianRegistryContract(
    blockchain: string,
    signer?: ethers.Wallet
  ) {
    const client = this.getEvmClientOrThrow(blockchain);
    const provider = await client.getProvider();
    const contractAddress = getGuardianRegistryAddress(blockchain);
    if (signer) {
      return new ethers.Contract(
        contractAddress,
        guardianRegistryInterface.fragments,
        signer
      );
    }

    return new ethers.Contract(
      contractAddress,
      guardianRegistryInterface.fragments,
      provider
    );
  }

  private async executeGuardianContract(
    walletId: string,
    blockchain: string,
    signerWallet: WalletModel,
    method: string,
    args: any[]
  ): Promise<string> {
    // On-chain guardian operations are disabled under non-custodial policy
    throw new Error('On-chain guardian operations require external signer; keys are never stored server-side');
    
    /*
    const client = this.getEvmClientOrThrow(blockchain);
    const provider = await client.getProvider();
    const signer = new ethers.Wallet(privateKey, provider);

    const contract = await this.getGuardianRegistryContract(blockchain, signer);
    const tx = await contract[method](...args);
    const receipt: TransactionReceipt = await tx.wait(1);

    await this.recordGuardianTransaction(
      walletId,
      blockchain,
      signer.address,
      tx.hash,
      receipt,
      method
    );
    return txHash;
    */
  }

  private async recordGuardianTransaction(
    walletId: string,
    blockchain: string,
    fromAddress: string,
    txHash: string,
    receipt: TransactionReceipt,
    action: string
  ): Promise<void> {
    try {
      await prisma.transaction.create({
        data: {
          walletId,
          txHash,
          blockchain,
          blockNumber:
            typeof receipt.blockNumber === 'number'
              ? BigInt(receipt.blockNumber)
              : undefined,
          fromAddress: this.normalizeAddress(fromAddress),
          toAddress: getGuardianRegistryAddress(blockchain),
          amount: '0',
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          confirmations: (typeof receipt.confirmations === 'function' ? await receipt.confirmations() : receipt.confirmations) as number | undefined,
          type: 'contract',
          memo: action,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to record guardian registry transaction', error, {
        walletId,
        txHash,
      });
    }
  }

  private async getRecoveryApprovalCount(
    blockchain: string,
    walletAddress: string,
    recoveryHash: string
  ): Promise<number> {
    if (!this.canUseOnChain(blockchain)) {
      return 1;
    }

    const contract = await this.getGuardianRegistryContract(blockchain);
    const approvals: bigint = await contract.recoveryApprovals(
      this.normalizeAddress(walletAddress),
      recoveryHash
    );

    return Number(approvals);
  }

  private async registerGuardianOnChain(
    wallet: WalletModel,
    guardianUserId: string
  ): Promise<void> {
    if (!this.canUseOnChain(wallet.blockchain)) {
      return;
    }
    if (!wallet.address) {
      throw new Error('Wallet missing on-chain address');
    }

    const guardianWallet = await this.getUserWalletForChain(
      guardianUserId,
      wallet.blockchain
    );

    if (!guardianWallet?.address) {
      throw new Error('Guardian wallet not found on target blockchain');
    }

    await this.executeGuardianContract(
      wallet.id,
      wallet.blockchain,
      wallet,
      'registerGuardian',
      [
        this.normalizeAddress(wallet.address),
        this.normalizeAddress(guardianWallet.address),
      ]
    );
  }

  /**
   * Add guardian to wallet
   */
  async addGuardian(
    walletId: string,
    guardianUserId: string,
    guardianEmail?: string,
    guardianName?: string
  ): Promise<any> {
    try {
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.address) {
        throw new Error('Wallet missing on-chain address');
      }

      if (this.canUseOnChain(wallet.blockchain)) {
        await this.registerGuardianOnChain(wallet, guardianUserId);
      }

      const guardian = await prisma.walletGuardian.create({
        data: {
          walletId,
          guardianUserId,
          guardianEmail,
          guardianName,
          guardianAddress: undefined, // Will be set when guardian wallet is linked
          status: 'pending',
        },
      });

      // Send notification to guardian
      await this.notifyGuardian(guardian);

      return guardian;
    } catch (error) {
      logger.error('Error adding guardian', error);
      throw error;
    }
  }

  /**
   * Guardian accepts invitation
   */
  async acceptGuardianship(guardianId: string): Promise<void> {
    try {
      await prisma.walletGuardian.update({
        where: { id: guardianId },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error accepting guardianship', error);
      throw error;
    }
  }

  /**
   * Initiate recovery process
   */
  async initiateRecovery(
    walletId: string,
    newOwnerAddress: string,
    initiatorUserId: string
  ): Promise<any> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        include: {
          guardians: {
            where: { status: 'accepted' },
          },
        },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.guardians || wallet.guardians.length < 3) {
        throw new Error('Insufficient guardians. At least 3 guardians required for recovery.');
      }

      // Generate recovery code
      const recoveryCode = randomBytes(32).toString('hex');
      const recoveryHash = ethers.keccak256(ethers.toUtf8Bytes(recoveryCode));
      const normalizedNewOwner = this.normalizeAddress(newOwnerAddress);

      let onChainTxHash: string | undefined;

      if (this.canUseOnChain(wallet.blockchain)) {
        onChainTxHash = await this.executeGuardianContract(
          walletId,
          wallet.blockchain,
          wallet,
          'initiateRecovery',
          [
            this.normalizeAddress(wallet.address),
            normalizedNewOwner,
            recoveryHash,
          ]
        );
      }

      // Create recovery record (using audit log for now)
      await prisma.auditLog.create({
        data: {
          userId: wallet.userId,
          action: 'recovery_initiated',
          resource: 'wallet',
          resourceId: walletId,
          platform: 'api',
          status: 'success',
          metadata: {
            recoveryCodeHash: recoveryHash,
            newOwnerAddress: normalizedNewOwner,
            onChainTxHash,
            rawNewOwnerAddress: newOwnerAddress,
            initiatorUserId,
            guardiansCount: wallet.guardians.length,
          },
        },
      });

      // Notify all guardians
      for (const guardian of wallet.guardians) {
        await this.notifyGuardianRecovery(guardian, recoveryCode);
      }

      return {
        recoveryCode,
        guardiansNotified: wallet.guardians.length,
        onChainTxHash,
      };
    } catch (error) {
      logger.error('Error initiating recovery', error);
      throw error;
    }
  }

  /**
   * Guardian approves recovery
   */
  async approveRecovery(
    walletId: string,
    guardianUserId: string,
    recoveryCode: string
  ): Promise<{ approved: number; required: number; executed: boolean }> {
    try {
      const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.address) {
        throw new Error('Wallet missing address');
      }

      const guardian = await prisma.walletGuardian.findFirst({
        where: {
          walletId,
          guardianUserId,
          status: 'accepted',
        },
      });

      if (!guardian) {
        throw new Error('Guardian not found or not authorized');
      }

      // Update guardian record
      await prisma.walletGuardian.update({
        where: { id: guardian.id },
        data: {
          recoveryAttempts: { increment: 1 },
          lastRecoveryAt: new Date(),
        },
      });

      // Get all guardians for this wallet
      const allGuardians = await prisma.walletGuardian.findMany({
        where: {
          walletId,
          status: 'accepted',
        },
      });

      const totalGuardians = allGuardians.length;
      const requiredApprovals = Math.ceil(totalGuardians * 0.6); // 60% threshold

      const latestRecovery = await prisma.auditLog.findFirst({
        where: {
          resourceId: walletId,
          action: 'recovery_initiated',
        },
        orderBy: { createdAt: 'desc' },
      });

      const metadata = (latestRecovery?.metadata || {}) as Record<string, any>;
      const storedHash = metadata.recoveryCodeHash as string | undefined;
      const storedNewOwner = metadata.newOwnerAddress as string | undefined;

      if (!storedHash || !storedNewOwner) {
        throw new Error('No active recovery request found');
      }

      const providedHash = ethers.keccak256(ethers.toUtf8Bytes(recoveryCode));
      if (providedHash !== storedHash) {
        throw new Error('Invalid recovery code');
      }

      const guardianWallet = await this.getUserWalletForChain(
        guardianUserId,
        wallet.blockchain
      );

      if (this.canUseOnChain(wallet.blockchain)) {
        await this.executeGuardianContract(
          walletId,
          wallet.blockchain,
          guardianWallet || wallet,
          'approveRecovery',
          [this.normalizeAddress(wallet.address), storedHash]
        );
      }

      let approvedCount = 1;
      if (this.canUseOnChain(wallet.blockchain)) {
        approvedCount = await this.getRecoveryApprovalCount(
          wallet.blockchain,
          wallet.address,
          storedHash
        );
      }

      const executed = approvedCount >= requiredApprovals;

      if (executed) {
        // Execute recovery - transfer wallet ownership
        await this.executeRecovery(
          wallet,
          storedHash,
          this.normalizeAddress(storedNewOwner),
          null
        );
      }

      return {
        approved: approvedCount,
        required: requiredApprovals,
        executed,
      };
    } catch (error) {
      logger.error('Error approving recovery', error);
      throw error;
    }
  }

  /**
   * Execute recovery after threshold met
   */
  private async executeRecovery(
    wallet: WalletModel,
    recoveryHash: string,
    newOwnerAddress: string,
    executorWallet: WalletModel | null
  ): Promise<void> {
    try {
      let onChainTxHash: string | undefined;

      if (executorWallet && this.canUseOnChain(wallet.blockchain)) {
        onChainTxHash = await this.executeGuardianContract(
          wallet.id,
          wallet.blockchain,
          executorWallet,
          'executeRecovery',
          [
            this.normalizeAddress(wallet.address),
            newOwnerAddress,
            recoveryHash,
          ]
        );
      }

      const targetWallet = await prisma.wallet.findFirst({
        where: {
          address: newOwnerAddress,
          blockchain: wallet.blockchain,
        },
      });

      if (targetWallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            userId: targetWallet.userId,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'recovery_executed',
          resource: 'wallet',
          resourceId: wallet.id,
          platform: 'api',
          status: 'success',
          metadata: {
            recoveryHash,
            newOwnerAddress,
            onChainTxHash,
            executedAt: new Date(),
          },
        },
      });

      logger.info('Recovery executed for wallet', {
        walletId: wallet.id,
        newOwnerAddress,
        onChainTxHash,
      });
    } catch (error) {
      logger.error('Error executing recovery', error, { walletId: wallet.id });
      throw error;
    }
  }

  /**
   * Get guardians for a wallet
   */
  async getGuardians(walletId: string): Promise<any[]> {
    const guardians = await prisma.walletGuardian.findMany({
      where: { walletId },
      include: {
        guardian: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return guardians;
  }

  /**
   * Remove guardian
   */
  async removeGuardian(guardianId: string): Promise<void> {
    const guardianRecord = await prisma.walletGuardian.findUnique({
      where: { id: guardianId },
      include: {
        wallet: true,
      },
    });

    if (!guardianRecord) {
      throw new Error('Guardian not found');
    }

    if (guardianRecord.wallet && guardianRecord.guardianUserId && this.canUseOnChain(guardianRecord.wallet.blockchain)) {
      const guardianWallet = await this.getUserWalletForChain(
        guardianRecord.guardianUserId,
        guardianRecord.wallet.blockchain
      );

      if (!guardianWallet?.address) {
        logger.warn('Guardian wallet missing on-chain state for revocation', {
          guardianId,
        });
      } else {
        await this.executeGuardianContract(
          guardianRecord.walletId,
          guardianRecord.wallet.blockchain,
          guardianRecord.wallet,
          'revokeGuardian',
          [
            this.normalizeAddress(guardianRecord.wallet.address),
            this.normalizeAddress(guardianWallet.address),
          ]
        );
      }
    }

    await prisma.walletGuardian.delete({
      where: { id: guardianId },
    });
  }

  /**
   * Notify guardian of invitation
   */
  private async notifyGuardian(guardian: any): Promise<void> {
    // In production, send email/notification
    logger.info('Notifying guardian', { guardianEmail: guardian.guardianEmail });
  }

  /**
   * Notify guardian of recovery request
   */
  private async notifyGuardianRecovery(guardian: any, recoveryCode: string): Promise<void> {
    // In production, send email/notification with recovery code
    logger.info('Notifying guardian of recovery request', { 
      guardianEmail: guardian.guardianEmail,
      hasRecoveryCode: !!recoveryCode,
    });
  }
}

const recoveryService = new RecoveryService();
export default recoveryService;

