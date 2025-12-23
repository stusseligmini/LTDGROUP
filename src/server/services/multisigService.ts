import { PendingTransaction, Wallet as WalletModel } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { ethers, TransactionReceipt } from 'ethers';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/security/encryption';
import {
  buildSafeInitializer,
  buildSafeTypedData,
  getMultiSigOnChainConfig,
  gnosisSafeInterface,
  gnosisFactoryInterface,
  packSafeSignatures,
  parseProxyAddressFromReceipt,
  type SafeTransactionData,
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

export class MultiSigService {
  /**
   * Create a multi-signature wallet
   */
  async createMultiSigWallet(
    userId: string,
    blockchain: string,
    requiredSignatures: number,
    signers: Array<{ address: string; name?: string; email?: string }>
  ): Promise<any> {
    try {
      // Create wallet record
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          blockchain,
          address: 'pending', // Will be updated after smart contract deployment
          walletType: 'multisig',
          requiredSignatures,
          totalSigners: signers.length,
          label: `MultiSig ${requiredSignatures}/${signers.length}`,
        },
      });

      // Add signers
      for (const signer of signers) {
        const normalizedSignerAddress = this.normalizeAddress(signer.address);
        await prisma.multiSigSigner.create({
          data: {
            walletId: wallet.id,
            address: normalizedSignerAddress,
            name: signer.name,
            email: signer.email,
          },
        });
      }

      let contractAddress: string | null = null;

      if (this.canUseOnChain(blockchain)) {
        try {
          contractAddress = await this.deployMultiSigContract(
            userId,
            blockchain,
            wallet.id,
            signers,
            requiredSignatures
          );
        } catch (deploymentError) {
          logger.error('On-chain multi-sig deployment failed, falling back to deterministic address', deploymentError, {
            walletId: wallet.id,
            blockchain,
          });
        }
      }

      if (!contractAddress) {
        contractAddress = this.generateMultiSigAddress(wallet.id);
      }

      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { address: contractAddress },
      });

      return updatedWallet;
    } catch (error) {
      logger.error('Error creating multi-sig wallet', error);
      throw error;
    }
  }

  /**
   * Propose a transaction
   */
  async proposeTransaction(
    walletId: string,
    proposerId: string,
    toAddress: string,
    amount: string,
    blockchain: string,
    memo?: string
  ): Promise<any> {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        include: { multiSigSigners: true },
      });

      if (!wallet || wallet.walletType !== 'multisig') {
        throw new Error('Invalid multi-sig wallet');
      }

      const proposerAddress = this.normalizeAddress(proposerId);

      // Verify proposer is a signer
      const isSigner = wallet.multiSigSigners.some(
        s => this.normalizeAddress(s.address) === proposerAddress
      );
      if (!isSigner) {
        throw new Error('Proposer is not a signer of this wallet');
      }

      // Create pending transaction
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const pendingTx = await prisma.pendingTransaction.create({
        data: {
          walletId,
          toAddress,
          amount,
          blockchain,
          memo,
          requiredSigs: wallet.requiredSignatures || 1,
          currentSigs: 1, // Proposer automatically signs
          signedBy: [proposerAddress],
          createdBy: proposerAddress,
          expiresAt,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: wallet.userId,
          action: 'multisig_transaction_proposed',
          resource: 'wallet',
          resourceId: walletId,
          platform: 'api',
          status: 'success',
          metadata: {
            transactionId: pendingTx.id,
            proposer: proposerAddress,
            amount,
            toAddress,
          },
        },
      });

      return pendingTx;
    } catch (error) {
      logger.error('Error proposing transaction', error);
      throw error;
    }
  }

  /**
   * Sign a pending transaction
   */
  async signTransaction(
    transactionId: string,
    signerAddress: string
  ): Promise<any> {
    try {
      const normalizedSigner = this.normalizeAddress(signerAddress);
      const pendingTx = await prisma.pendingTransaction.findUnique({
        where: { id: transactionId },
        include: {
          wallet: {
            include: {
              multiSigSigners: true,
            },
          },
        },
      });

      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      if (pendingTx.status !== 'pending') {
        throw new Error('Transaction is not pending');
      }

      if (new Date() > pendingTx.expiresAt) {
        await prisma.pendingTransaction.update({
          where: { id: transactionId },
          data: { status: 'expired' },
        });
        throw new Error('Transaction has expired');
      }

      // Check if already signed
      if (pendingTx.signedBy.includes(normalizedSigner)) {
        throw new Error('Already signed by this address');
      }

      // Verify signer is authorized
      const isSigner = pendingTx.wallet.multiSigSigners.some(
        (s: any) => this.normalizeAddress(s.address) === normalizedSigner
      );
      if (!isSigner) {
        throw new Error('Not authorized to sign this transaction');
      }

      // Add signature
      const updatedSignedBy = [...pendingTx.signedBy, normalizedSigner];
      const newSigCount = updatedSignedBy.length;

      const updateData: any = {
        signedBy: updatedSignedBy,
        currentSigs: newSigCount,
      };

      // Check if threshold reached
      if (newSigCount >= pendingTx.requiredSigs) {
        if (
          pendingTx.wallet &&
          pendingTx.wallet.address !== 'pending' &&
          this.canUseOnChain(pendingTx.blockchain)
        ) {
          const execution = await this.executePendingTransactionOnChain(
            pendingTx,
            updatedSignedBy
          );
          updateData.status = 'executed';
          updateData.executedAt = new Date();
          updateData.executedTxHash = execution.txHash;
        } else {
          updateData.status = 'executed';
          updateData.executedAt = new Date();
          updateData.executedTxHash = `0x${Date.now().toString(16)}`;
        }
      }

      const updated = await prisma.pendingTransaction.update({
        where: { id: transactionId },
        data: updateData,
      });

      return updated;
    } catch (error) {
      logger.error('Error signing transaction', error);
      throw error;
    }
  }

  /**
   * Reject/cancel a pending transaction
   */
  async cancelTransaction(
    transactionId: string,
    cancellerAddress: string
  ): Promise<void> {
    try {
      const pendingTx = await prisma.pendingTransaction.findUnique({
        where: { id: transactionId },
        include: {
          wallet: {
            include: {
              multiSigSigners: true,
            },
          },
        },
      });

      if (!pendingTx) {
        throw new Error('Transaction not found');
      }

      // Verify canceller is a signer
      const isSigner = pendingTx.wallet.multiSigSigners.some((s: any) => s.address === cancellerAddress);
      if (!isSigner) {
        throw new Error('Not authorized to cancel this transaction');
      }

      await prisma.pendingTransaction.update({
        where: { id: transactionId },
        data: { status: 'cancelled' },
      });
    } catch (error) {
      logger.error('Error cancelling transaction', error);
      throw error;
    }
  }

  /**
   * Get pending transactions for a wallet
   */
  async getPendingTransactions(walletId: string): Promise<any[]> {
    const transactions = await prisma.pendingTransaction.findMany({
      where: {
        walletId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  /**
   * Get multi-sig wallet details
   */
  async getMultiSigWallet(walletId: string): Promise<any> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        multiSigSigners: true,
      },
    });

    return wallet;
  }

  private isOnChainEnabled(): boolean {
    return process.env.MULTISIG_ONCHAIN_ENABLED === 'true';
  }

  private isEvmChain(blockchain: string): blockchain is EvmChain {
    return Object.prototype.hasOwnProperty.call(
      evmClients,
      blockchain.toLowerCase()
    );
  }

  private getEvmClientOrThrow(blockchain: string): EthereumClient {
    if (!this.isEvmChain(blockchain)) {
      throw new Error(`Unsupported blockchain for on-chain multisig: ${blockchain}`);
    }

    return evmClients[blockchain.toLowerCase() as EvmChain];
  }

  private async deriveDeploymentKey(userId: string, blockchain: string): Promise<string | null> {
    // Deployment key derivation not yet implemented; placeholder keeps compile-time contract intact
    return null;
  }

  private async getFundingWallet(
    userId: string,
    blockchain: string
  ): Promise<WalletModel | null> {
    return prisma.wallet.findFirst({
      where: {
        userId,
        blockchain,
        walletType: 'standard',
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private normalizeAddress(address: string): string {
    return ethers.getAddress(address);
  }

  private canUseOnChain(blockchain: string): boolean {
    return this.isOnChainEnabled() && this.isEvmChain(blockchain);
  }

  private async deployMultiSigContract(
    userId: string,
    blockchain: string,
    walletId: string,
    signers: Array<{ address: string }>,
    requiredSignatures: number
  ): Promise<string | null> {
    if (!this.canUseOnChain(blockchain)) {
      return null;
    }

    const fundingWallet = await this.getFundingWallet(userId, blockchain);
    if (!fundingWallet?.address) {
      throw new Error('No funded wallet available to deploy multi-sig contract');
    }

    // Derive private key from mnemonic for contract deployment
    // Note: This requires the user to provide their mnemonic or have it stored securely
    // In production, use a dedicated deployment wallet with minimal funds
    const deploymentKey = await this.deriveDeploymentKey(userId, blockchain);
    if (!deploymentKey) {
      throw new Error('Cannot derive deployment key - mnemonic not available');
    }

    const client = this.getEvmClientOrThrow(blockchain);
    const provider = await client.getProvider();
    // const deployer = new ethers.Wallet(privateKey, provider);

    /*
    const config = getMultiSigOnChainConfig(blockchain);
    const owners = signers.map(s => this.normalizeAddress(s.address));
    const initializer = buildSafeInitializer(
      owners,
      requiredSignatures,
      config.fallbackHandler
    );
    const saltNonce = BigInt(Date.now());

    const tx = await deployer.sendTransaction({
      to: config.factoryAddress,
      data: gnosisFactoryInterface.encodeFunctionData('createProxyWithNonce', [
        config.singletonAddress,
        initializer,
        saltNonce,
      ]),
      value: 0n,
    });

    const receipt = await tx.wait(1);
    
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }
    
    const deployedAddress = parseProxyAddressFromReceipt(receipt);

    if (!deployedAddress) {
      throw new Error('Failed to derive deployed multi-sig contract address');
    }

    await this.recordContractDeployment(
      walletId,
      blockchain,
      deployer.address,
      tx.hash,
      receipt
    );

    return deployedAddress;
    */

    // On-chain deployment not yet implemented; return null to indicate stubbed behavior
    return null;
  }

  private async executePendingTransactionOnChain(
    pendingTx: PendingTransaction & { wallet: WalletModel | null },
    signedBy: string[]
  ): Promise<{ txHash: string }> {
    if (!pendingTx.wallet) {
      throw new Error('Multi-sig wallet not loaded for execution');
    }

    if (!pendingTx.wallet.address || pendingTx.wallet.address === 'pending') {
      throw new Error('Multi-sig wallet not yet deployed on-chain');
    }

    if (!this.canUseOnChain(pendingTx.blockchain)) {
      throw new Error('On-chain execution unavailable for this blockchain');
    }

    const walletAddress = this.normalizeAddress(pendingTx.wallet.address);
    const client = this.getEvmClientOrThrow(pendingTx.blockchain);
    const provider = await client.getProvider();
    const chainId = client.getChainId();
    const safeContract = new ethers.Contract(
      walletAddress,
      gnosisSafeInterface.fragments,
      provider
    );

    const nonce: bigint = BigInt(await safeContract.nonce());
    const amount = pendingTx.amount || '0';

    const safeTx: SafeTransactionData = {
      to: this.normalizeAddress(pendingTx.toAddress),
      value: ethers.parseEther(amount),
      data:
        pendingTx.memo && pendingTx.memo.startsWith('0x')
          ? pendingTx.memo
          : '0x',
      operation: 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce,
    };

    const typedData = buildSafeTypedData(chainId, walletAddress, safeTx);
    const normalizedSigners = signedBy.map(addr => this.normalizeAddress(addr));

    const signerWallets = await prisma.wallet.findMany({
      where: {
        address: { in: normalizedSigners },
        blockchain: pendingTx.blockchain,
      },
    });

    if (signerWallets.length < normalizedSigners.length) {
      throw new Error('Missing signer wallets for on-chain execution');
    }

    const signaturePayloads: Array<{ signer: string; signature: string }> = [];

    for (const signer of normalizedSigners) {
      const signerWallet = signerWallets.find(
        w => this.normalizeAddress(w.address) === signer
      );

      // No mnemonic available or stored by design; on-chain signing unsupported
      throw new Error('Multi-sig signing requires implementing key management without mnemonic storage');
      
      // TODO: Implement mnemonic-based key derivation
      throw new Error('Multi-sig signing requires implementing mnemonic key derivation');

      /*
      const walletSigner = new ethers.Wallet(
        privateKey,
        provider
      );

      const signature = await walletSigner.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );

      signaturePayloads.push({
        signer: walletSigner.address,
        signature,
      });
      */
    }

    // TODO: Implement mnemonic-based key derivation
    throw new Error('Multi-sig on-chain execution requires implementing signer key management without mnemonic storage');

    /*
    const packedSignatures = packSafeSignatures(signaturePayloads);

    const executorWalletRecord = signerWallets.find(
      w => this.normalizeAddress(w.address) === normalizedSigners[0]
    );

    if (!executorWalletRecord?.mnemonicHash) {
      throw new Error('Unable to load executor wallet for multi-sig transaction');
    }
    
    const executor = new ethers.Wallet(privateKey, provider);

    const txResponse = await (safeContract as any)
      .connect(executor)
      .execTransaction(
        safeTx.to,
        safeTx.value,
        safeTx.data,
        safeTx.operation,
        safeTx.safeTxGas,
        safeTx.baseGas,
        safeTx.gasPrice,
        safeTx.gasToken,
        safeTx.refundReceiver,
        packedSignatures,
        {
          gasLimit: 300000n,
        }
      );

    const receipt: TransactionReceipt = await txResponse.wait(1);

    await this.recordMultiSigExecution(
      pendingTx.walletId,
      pendingTx.blockchain,
      walletAddress,
      txResponse.hash,
      receipt,
      pendingTx.toAddress,
      amount
    );

    return { txHash: txResponse.hash };
    */
  }

  private async recordContractDeployment(
    walletId: string,
    blockchain: string,
    fromAddress: string,
    txHash: string,
    receipt: TransactionReceipt
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
          toAddress: this.normalizeAddress(receipt.to || fromAddress),
          amount: '0',
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          confirmations: (typeof receipt.confirmations === 'function' ? await receipt.confirmations() : receipt.confirmations) as number | undefined,
          type: 'contract',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to record multi-sig deployment transaction', error, {
        walletId,
        txHash,
      });
    }
  }

  private async recordMultiSigExecution(
    walletId: string,
    blockchain: string,
    fromAddress: string,
    txHash: string,
    receipt: TransactionReceipt,
    toAddress: string,
    amount: string
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
          toAddress: this.normalizeAddress(toAddress),
          amount,
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          confirmations: (typeof receipt.confirmations === 'function' ? await receipt.confirmations() : receipt.confirmations) as number | undefined,
          type: 'contract',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to record multi-sig execution transaction', error, {
        walletId,
        txHash,
      });
    }
  }

  /**
   * Generate a multi-sig address (placeholder)
   */
  private generateMultiSigAddress(walletId: string): string {
    // In production, this would be the actual smart contract address after deployment
    // For now, generate a deterministic address based on wallet ID
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`multisig_${walletId}`));
    return ethers.getAddress('0x' + hash.slice(26));
  }

  /**
   * Add a signer to existing multi-sig wallet
   */
  async addSigner(
    walletId: string,
    signerAddress: string,
    name?: string,
    email?: string
  ): Promise<void> {
    try {
      await prisma.multiSigSigner.create({
        data: {
          walletId,
          address: signerAddress,
          name,
          email,
        },
      });

      // Update total signers count
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        include: { multiSigSigners: true },
      });

      if (wallet) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { totalSigners: wallet.multiSigSigners.length },
        });
      }
    } catch (error) {
      logger.error('Error adding signer', error);
      throw error;
    }
  }

  /**
   * Remove a signer from multi-sig wallet
   */
  async removeSigner(
    walletId: string,
    signerAddress: string
  ): Promise<void> {
    try {
      await prisma.multiSigSigner.deleteMany({
        where: {
          walletId,
          address: signerAddress,
        },
      });

      // Update total signers count
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
        include: { multiSigSigners: true },
      });

      if (wallet) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { totalSigners: wallet.multiSigSigners.length },
        });
      }
    } catch (error) {
      logger.error('Error removing signer', error);
      throw error;
    }
  }
}

const multiSigService = new MultiSigService();
export default multiSigService;

