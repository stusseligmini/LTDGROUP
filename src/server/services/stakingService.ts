import { Connection, PublicKey, StakeProgram, Authorized, Lockup, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { ethers, Contract } from 'ethers';
import { prisma } from '@/server/db/client';
import { logger } from '@/lib/logger';
import { ethereumClient } from '@/lib/blockchain/ethereum';
import { celoClient } from '@/lib/blockchain/celo';

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const ETHEREUM_RPC = process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth';

export class StakingService {
  /**
   * Get staking positions for user
   */
  async getStakingPositions(userId: string): Promise<any[]> {
    const positions = await prisma.stakingPosition.findMany({
      where: { userId },
      orderBy: { stakedAt: 'desc' },
    });
    return positions;
  }

  /**
   * Stake SOL on Solana
   */
  async stakeSolana(
    userId: string,
    walletId: string,
    amount: string,
    validatorAddress: string,
    privateKey: Uint8Array
  ): Promise<string> {
    try {
      const connection = new Connection(SOLANA_RPC);
      
      // Get wallet
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      const fromPubkey = new PublicKey(wallet.address);
      const validatorPubkey = new PublicKey(validatorAddress);
      const keypair = Keypair.fromSecretKey(privateKey);
      
      // Create stake account keypair
      const stakeAccountKeypair = Keypair.generate();
      
      // Calculate amount in lamports
      const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
      
      // Build stake account creation and delegation transaction
      const transaction = new Transaction().add(
        // Create stake account
        StakeProgram.createAccount({
          fromPubkey,
          stakePubkey: stakeAccountKeypair.publicKey,
          authorized: new Authorized(fromPubkey, fromPubkey),
          lamports,
        }),
        // Delegate to validator
        StakeProgram.delegate({
          stakePubkey: stakeAccountKeypair.publicKey,
          authorizedPubkey: fromPubkey,
          votePubkey: validatorPubkey,
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Sign transaction
      transaction.sign(keypair, stakeAccountKeypair);
      
      // Send and confirm transaction
      const signature = await connection.sendTransaction(transaction, [keypair, stakeAccountKeypair], {
        skipPreflight: false,
        maxRetries: 3,
      });
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Create staking position in database
      const position = await prisma.stakingPosition.create({
        data: {
          userId,
          walletId,
          blockchain: 'solana',
          amount, // Required field
          protocol: 'native',
          validator: validatorAddress,
          stakedAmount: amount,
          status: 'active',
          stakeAccountAddress: stakeAccountKeypair.publicKey.toString(),
          txHash: signature,
        },
      });

      logger.info('Solana staking executed', { signature, positionId: position.id, amount, validatorAddress });
      return signature;
    } catch (error) {
      logger.error('Error staking Solana', error, { userId, walletId, amount, validatorAddress });
      throw error;
    }
  }

  /**
   * Stake ETH via Lido
   */
  async stakeEthereum(
    userId: string,
    walletId: string,
    amount: string,
    privateKey: string
  ): Promise<string> {
    try {
      // Lido staking contract address
      const LIDO_ADDRESS = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
      
      // Get wallet
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Get provider and create wallet
      const provider = await ethereumClient['getHealthyProvider']();
      const ethersWallet = new ethers.Wallet(privateKey, provider);
      
      // Lido contract ABI (simplified - just submit function)
      const lidoAbi = [
        'function submit(address _referral) payable returns (uint256)',
      ];
      
      const lidoContract = new ethers.Contract(LIDO_ADDRESS, lidoAbi, ethersWallet);
      
      // Submit ETH to Lido
      const amountWei = ethers.parseEther(amount);
      const txResponse = await lidoContract.submit(ethersWallet.address, {
        value: amountWei,
      });
      
      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      
      // Get stETH amount received (from events or contract call)
      // For now, use the same amount (1:1 ratio initially)
      
      // Create staking position
      const position = await prisma.stakingPosition.create({
        data: {
          userId,
          walletId,
          blockchain: 'ethereum',
          amount, // Required field
          protocol: 'lido',
          stakedAmount: amount,
          status: 'active',
          currentApy: 4.5, // Lido APY (would fetch from contract in production)
          txHash: receipt.hash,
        },
      });

      logger.info('Ethereum Lido staking executed', { txHash: receipt.hash, positionId: position.id, amount });
      return receipt.hash;
    } catch (error) {
      logger.error('Error staking Ethereum', error, { userId, walletId, amount });
      throw error;
    }
  }

  /**
   * Stake CELO (via Locked Gold contract)
   */
  async stakeCelo(
    userId: string,
    walletId: string,
    amount: string,
    privateKey: string
  ): Promise<string> {
    try {
      // Celo Locked Gold contract address (mainnet)
      const LOCKED_GOLD_ADDRESS = '0x6cc083aed9e3ebe302a6336dbc7c921c9f03349e';
      
      // Get wallet
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Get Celo provider
      const provider = await celoClient['getHealthyProvider']();
      const ethersWallet = new ethers.Wallet(privateKey, provider);
      
      // Locked Gold contract ABI (simplified)
      const lockedGoldAbi = [
        'function lock() payable',
      ];
      
      const lockedGoldContract = new ethers.Contract(LOCKED_GOLD_ADDRESS, lockedGoldAbi, ethersWallet);
      
      // Lock CELO
      const amountWei = ethers.parseEther(amount);
      const txResponse = await lockedGoldContract.lock({
        value: amountWei,
      });
      
      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      
      // Create staking position
      const position = await prisma.stakingPosition.create({
        data: {
          userId,
          walletId,
          blockchain: 'celo',
          amount, // Required field
          protocol: 'native',
          stakedAmount: amount,
          status: 'active',
          currentApy: 5.2, // Celo APY (would fetch from governance in production)
          txHash: receipt.hash,
        },
      });

      logger.info('Celo staking executed', { txHash: receipt.hash, positionId: position.id, amount });
      return receipt.hash;
    } catch (error) {
      logger.error('Error staking Celo', error, { userId, walletId, amount });
      throw error;
    }
  }

  /**
   * Unstake from position
   */
  async unstake(
    positionId: string,
    privateKey: string | Uint8Array
  ): Promise<string> {
    try {
      const position = await prisma.stakingPosition.findUnique({
        where: { id: positionId },
        include: { wallet: true },
      });
      
      if (!position) {
        throw new Error('Staking position not found');
      }
      
      let txHash: string;
      
      if (position.blockchain === 'solana') {
        // Solana unstaking
        const connection = new Connection(SOLANA_RPC);
        const keypair = Keypair.fromSecretKey(privateKey as Uint8Array);
        const stakePubkey = new PublicKey(position.stakeAccountAddress || position.wallet.address);
        
        // Deactivate stake account
        const deactivateTx = new Transaction().add(
          StakeProgram.deactivate({
            stakePubkey,
            authorizedPubkey: keypair.publicKey,
          })
        );
        
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        deactivateTx.recentBlockhash = blockhash;
        deactivateTx.feePayer = keypair.publicKey;
        deactivateTx.sign(keypair);
        
        const signature = await connection.sendTransaction(deactivateTx, [keypair], {
          skipPreflight: false,
          maxRetries: 3,
        });
        
        await connection.confirmTransaction(signature, 'confirmed');
        txHash = signature;
        
      } else if (position.blockchain === 'ethereum' && position.protocol === 'lido') {
        // Lido unstaking (request withdrawal)
        const LIDO_ADDRESS = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
        const provider = await ethereumClient['getHealthyProvider']();
        const ethersWallet = new ethers.Wallet(privateKey as string, provider);
        
        const lidoAbi = [
          'function requestWithdrawals(uint256[] _amounts, address _owner) external returns (uint256)',
        ];
        
        const lidoContract = new ethers.Contract(LIDO_ADDRESS, lidoAbi, ethersWallet);
        const amountWei = ethers.parseEther(position.stakedAmount || position.amount);
        
        const txResponse = await lidoContract.requestWithdrawals([amountWei], ethersWallet.address);
        const receipt = await txResponse.wait(1);
        txHash = receipt.hash;
        
      } else if (position.blockchain === 'celo') {
        // Celo unstaking (unlock)
        const LOCKED_GOLD_ADDRESS = '0x6cc083aed9e3ebe302a6336dbc7c921c9f03349e';
        const provider = await celoClient['getHealthyProvider']();
        const ethersWallet = new ethers.Wallet(privateKey as string, provider);
        
        const lockedGoldAbi = [
          'function unlock(uint256 value)',
        ];
        
        const lockedGoldContract = new ethers.Contract(LOCKED_GOLD_ADDRESS, lockedGoldAbi, ethersWallet);
        const amountWei = ethers.parseEther(position.stakedAmount || position.amount);
        
        const txResponse = await lockedGoldContract.unlock(amountWei);
        const receipt = await txResponse.wait(1);
        txHash = receipt.hash;
        
      } else {
        throw new Error(`Unstaking not implemented for ${position.blockchain}/${position.protocol}`);
      }
      
      // Update position
      await prisma.stakingPosition.update({
        where: { id: positionId },
        data: {
          status: 'unstaking',
          unstakeRequestedAt: new Date(),
          unstakeTxHash: txHash,
        },
      });
      
      logger.info('Unstaking initiated', { positionId, txHash, blockchain: position.blockchain });
      return txHash;
    } catch (error) {
      logger.error('Error unstaking', error, { positionId });
      throw error;
    }
  }

  /**
   * Calculate staking rewards
   */
  async calculateRewards(positionId: string): Promise<number> {
    const position = await prisma.stakingPosition.findUnique({
      where: { id: positionId },
    });

    if (!position || !position.currentApy || !position.stakedAmount || !position.stakedAt) {
      return 0;
    }

    const stakedAmount = parseFloat(position.stakedAmount);
    const daysSinceStaked = Math.floor(
      (Date.now() - position.stakedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const apy = parseFloat(position.currentApy.toString()) / 100;
    const dailyRate = apy / 365;
    const rewards = stakedAmount * dailyRate * daysSinceStaked;

    return rewards;
  }
}

export default new StakingService();

