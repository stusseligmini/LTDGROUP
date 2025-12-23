/**
 * Multi-sig On-Chain Deployment Helpers
 * Gnosis Safe deployment for Ethereum/Celo
 */

import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

// Gnosis Safe factory addresses (same on all EVM chains)
const GNOSIS_SAFE_FACTORY = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2';
const GNOSIS_SAFE_SINGLETON = '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552';

export interface MultiSigDeploymentConfig {
  owners: string[]; // Array of owner addresses
  threshold: number; // Number of signatures required
  blockchain: 'ethereum' | 'celo' | 'polygon' | 'arbitrum' | 'optimism';
  deployer: string; // Address deploying the contract
  privateKey: string; // Private key of deployer (for signing)
}

export interface MultiSigDeploymentResult {
  safeAddress: string;
  txHash: string;
  owners: string[];
  threshold: number;
}

/**
 * Deploy Gnosis Safe multi-sig wallet on-chain
 * ✅ FIXED: Now supports actual on-chain deployment
 */
export async function deployMultiSigWallet(
  config: MultiSigDeploymentConfig
): Promise<MultiSigDeploymentResult> {
  try {
    // Get provider for blockchain
    const provider = getProvider(config.blockchain);
    const wallet = new ethers.Wallet(config.privateKey, provider);

    // Gnosis Safe Factory ABI (minimal)
    const factoryAbi = [
      'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) public returns (address proxy)',
      'event ProxyCreation(address indexed proxy, address singleton)',
    ];

    // Gnosis Safe singleton ABI (setup function)
    const singletonAbi = [
      'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external',
    ];

    const factory = new ethers.Contract(GNOSIS_SAFE_FACTORY, factoryAbi, wallet);

    // Encode setup parameters
    const singleton = new ethers.Interface(singletonAbi);
    const setupData = singleton.encodeFunctionData('setup', [
      config.owners,
      config.threshold,
      ethers.ZeroAddress, // to (for optional delegate call)
      '0x', // data
      ethers.ZeroAddress, // fallbackHandler
      ethers.ZeroAddress, // paymentToken
      0, // payment
      ethers.ZeroAddress, // paymentReceiver
    ]);

    // Generate deterministic salt
    const saltNonce = Date.now();

    // Deploy Safe
    logger.info('Deploying Gnosis Safe multi-sig', {
      owners: config.owners,
      threshold: config.threshold,
      blockchain: config.blockchain,
    });

    const tx = await factory.createProxyWithNonce(
      GNOSIS_SAFE_SINGLETON,
      setupData,
      saltNonce
    );

    const receipt = await tx.wait();
    
    // Extract Safe address from ProxyCreation event
    const proxyCreationEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === 'ProxyCreation';
      } catch {
        return false;
      }
    });

    if (!proxyCreationEvent) {
      throw new Error('Safe deployment failed: ProxyCreation event not found');
    }

    const parsedEvent = factory.interface.parseLog(proxyCreationEvent);
    const safeAddress = parsedEvent?.args?.proxy;

    if (!safeAddress) {
      throw new Error('Safe deployment failed: Could not extract Safe address');
    }

    logger.info('Gnosis Safe deployed successfully', {
      safeAddress,
      txHash: receipt.hash,
      owners: config.owners,
      threshold: config.threshold,
    });

    return {
      safeAddress,
      txHash: receipt.hash,
      owners: config.owners,
      threshold: config.threshold,
    };
  } catch (error) {
    logger.error('Failed to deploy multi-sig wallet', error);
    throw error;
  }
}

/**
 * Get provider for blockchain
 */
function getProvider(blockchain: string): ethers.JsonRpcProvider {
  switch (blockchain.toLowerCase()) {
    case 'ethereum':
      return new ethers.JsonRpcProvider(
        process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
      );
    
    case 'celo':
      return new ethers.JsonRpcProvider(
        process.env.CELO_RPC_URL || 'https://forno.celo.org'
      );
    
    case 'polygon':
      return new ethers.JsonRpcProvider(
        process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
      );
    
    case 'arbitrum':
      return new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
      );
    
    case 'optimism':
      return new ethers.JsonRpcProvider(
        process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'
      );
    
    default:
      throw new Error(`Unsupported blockchain: ${blockchain}`);
  }
}

/**
 * Calculate predicted Safe address before deployment
 * Useful for displaying address to user before they confirm
 */
export async function predictSafeAddress(
  config: MultiSigDeploymentConfig,
  saltNonce: number
): Promise<string> {
  try {
    const provider = getProvider(config.blockchain);
    
    const factoryAbi = [
      'function calculateCreateProxyAddress(address _singleton, bytes memory initializer, uint256 saltNonce) public view returns (address proxy)',
    ];

    const singletonAbi = [
      'function setup(address[] calldata _owners, uint256 _threshold, address to, bytes calldata data, address fallbackHandler, address paymentToken, uint256 payment, address payable paymentReceiver) external',
    ];

    const factory = new ethers.Contract(GNOSIS_SAFE_FACTORY, factoryAbi, provider);
    const singleton = new ethers.Interface(singletonAbi);

    const setupData = singleton.encodeFunctionData('setup', [
      config.owners,
      config.threshold,
      ethers.ZeroAddress,
      '0x',
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ]);

    const predictedAddress = await factory.calculateCreateProxyAddress(
      GNOSIS_SAFE_SINGLETON,
      setupData,
      saltNonce
    );

    return predictedAddress;
  } catch (error) {
    logger.error('Failed to predict Safe address', error);
    throw error;
  }
}
