import { ethers, Interface, TransactionReceipt, TypedDataDomain, TypedDataField, Signature } from 'ethers';

export type EvmChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'celo';

const MULTISIG_FACTORY_ABI = [
  'event ProxyCreation(address proxy, address singleton)',
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
];

const MULTISIG_SAFE_ABI = [
  'function setup(address[] _owners,uint256 _threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)',
  'function nonce() view returns (uint256)',
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns (bool success)',
];

const GUARDIAN_REGISTRY_ABI = [
  'function registerGuardian(address wallet,address guardian)',
  'function revokeGuardian(address wallet,address guardian)',
  'function initiateRecovery(address wallet,address newOwner,bytes32 recoveryHash)',
  'function approveRecovery(address wallet,bytes32 recoveryHash)',
  'function executeRecovery(address wallet,address newOwner,bytes32 recoveryHash)',
  'function recoveryApprovals(address wallet,bytes32 recoveryHash) view returns (uint256)',
];

export type SafeTransactionData = {
  to: string;
  value: bigint;
  data: string;
  operation: number;
  safeTxGas: bigint;
  baseGas: bigint;
  gasPrice: bigint;
  gasToken: string;
  refundReceiver: string;
  nonce: bigint;
};

export interface MultiSigOnChainConfig {
  factoryAddress: string;
  singletonAddress: string;
  fallbackHandler: string;
}

const GNOSIS_FACTORY_INTERFACE = new Interface(MULTISIG_FACTORY_ABI);
const GNOSIS_SAFE_INTERFACE = new Interface(MULTISIG_SAFE_ABI);
const GUARDIAN_REGISTRY_INTERFACE = new Interface(GUARDIAN_REGISTRY_ABI);

export const gnosisFactoryInterface = GNOSIS_FACTORY_INTERFACE;
export const gnosisSafeInterface = GNOSIS_SAFE_INTERFACE;
export const guardianRegistryInterface = GUARDIAN_REGISTRY_INTERFACE;

const DEFAULT_SAFE_SINGLETON = '0xd9Db270C1B5E3Bd161E8c8503c55ceABeE709552';
const DEFAULT_SAFE_FACTORY = '0xa6B71E26C5e0845f74c5001100ceB4b907a3dAB0';

const CHAIN_SPECIFIC_CONFIG: Record<EvmChain, MultiSigOnChainConfig> = {
  ethereum: {
    factoryAddress:
      process.env.ETHEREUM_MULTISIG_FACTORY_ADDRESS ||
      process.env.MULTISIG_FACTORY_ADDRESS ||
      DEFAULT_SAFE_FACTORY,
    singletonAddress:
      process.env.ETHEREUM_MULTISIG_SINGLETON_ADDRESS ||
      process.env.MULTISIG_SINGLETON_ADDRESS ||
      DEFAULT_SAFE_SINGLETON,
    fallbackHandler:
      process.env.ETHEREUM_MULTISIG_FALLBACK_HANDLER ||
      process.env.MULTISIG_FALLBACK_HANDLER ||
      ethers.ZeroAddress,
  },
  polygon: {
    factoryAddress:
      process.env.POLYGON_MULTISIG_FACTORY_ADDRESS ||
      process.env.MULTISIG_FACTORY_ADDRESS ||
      DEFAULT_SAFE_FACTORY,
    singletonAddress:
      process.env.POLYGON_MULTISIG_SINGLETON_ADDRESS ||
      process.env.MULTISIG_SINGLETON_ADDRESS ||
      DEFAULT_SAFE_SINGLETON,
    fallbackHandler:
      process.env.POLYGON_MULTISIG_FALLBACK_HANDLER ||
      process.env.MULTISIG_FALLBACK_HANDLER ||
      ethers.ZeroAddress,
  },
  arbitrum: {
    factoryAddress:
      process.env.ARBITRUM_MULTISIG_FACTORY_ADDRESS ||
      process.env.MULTISIG_FACTORY_ADDRESS ||
      DEFAULT_SAFE_FACTORY,
    singletonAddress:
      process.env.ARBITRUM_MULTISIG_SINGLETON_ADDRESS ||
      process.env.MULTISIG_SINGLETON_ADDRESS ||
      DEFAULT_SAFE_SINGLETON,
    fallbackHandler:
      process.env.ARBITRUM_MULTISIG_FALLBACK_HANDLER ||
      process.env.MULTISIG_FALLBACK_HANDLER ||
      ethers.ZeroAddress,
  },
  optimism: {
    factoryAddress:
      process.env.OPTIMISM_MULTISIG_FACTORY_ADDRESS ||
      process.env.MULTISIG_FACTORY_ADDRESS ||
      DEFAULT_SAFE_FACTORY,
    singletonAddress:
      process.env.OPTIMISM_MULTISIG_SINGLETON_ADDRESS ||
      process.env.MULTISIG_SINGLETON_ADDRESS ||
      DEFAULT_SAFE_SINGLETON,
    fallbackHandler:
      process.env.OPTIMISM_MULTISIG_FALLBACK_HANDLER ||
      process.env.MULTISIG_FALLBACK_HANDLER ||
      ethers.ZeroAddress,
  },
  celo: {
    factoryAddress:
      process.env.CELO_MULTISIG_FACTORY_ADDRESS ||
      process.env.MULTISIG_FACTORY_ADDRESS ||
      DEFAULT_SAFE_FACTORY,
    singletonAddress:
      process.env.CELO_MULTISIG_SINGLETON_ADDRESS ||
      process.env.MULTISIG_SINGLETON_ADDRESS ||
      DEFAULT_SAFE_SINGLETON,
    fallbackHandler:
      process.env.CELO_MULTISIG_FALLBACK_HANDLER ||
      process.env.MULTISIG_FALLBACK_HANDLER ||
      ethers.ZeroAddress,
  },
};

export function getMultiSigOnChainConfig(blockchain: string): MultiSigOnChainConfig {
  const key = blockchain.toLowerCase() as EvmChain;
  const config = CHAIN_SPECIFIC_CONFIG[key];
  if (!config) {
    throw new Error(`Unsupported blockchain for multi-sig deployment: ${blockchain}`);
  }

  if (!config.factoryAddress || !config.singletonAddress) {
    throw new Error(`Missing multi-sig contract addresses for ${blockchain}`);
  }

  return config;
}

export function getGuardianRegistryAddress(blockchain: string): string {
  const key = blockchain.toLowerCase();
  const envKey = `SOCIAL_RECOVERY_CONTRACT_ADDRESS_${key.toUpperCase()}`;
  const address = process.env[envKey as keyof NodeJS.ProcessEnv] || process.env.SOCIAL_RECOVERY_CONTRACT_ADDRESS;

  if (!address) {
    throw new Error(`Missing guardian registry contract address for ${blockchain}`);
  }

  return ethers.getAddress(address);
}

export function buildSafeInitializer(owners: string[], threshold: number, fallbackHandler: string): string {
  return GNOSIS_SAFE_INTERFACE.encodeFunctionData('setup', [
    owners,
    threshold,
    ethers.ZeroAddress,
    '0x',
    fallbackHandler,
    ethers.ZeroAddress,
    0,
    ethers.ZeroAddress,
  ]);
}

export function parseProxyAddressFromReceipt(receipt: TransactionReceipt): string | null {
  for (const log of receipt.logs) {
    try {
      const parsed = GNOSIS_FACTORY_INTERFACE.parseLog(log);
      if (parsed?.name === 'ProxyCreation') {
        return ethers.getAddress(parsed.args.proxy as string);
      }
    } catch {
      continue;
    }
  }

  return null;
}

const SAFE_TX_TYPES: Record<string, TypedDataField[]> = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
};

export function buildSafeTypedData(chainId: number, safeAddress: string, tx: SafeTransactionData): {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: SafeTransactionData;
} {
  const domain: TypedDataDomain = {
    chainId,
    verifyingContract: ethers.getAddress(safeAddress),
  };

  return {
    domain,
    types: SAFE_TX_TYPES,
    message: tx,
  };
}

export function packSafeSignatures(signatures: Array<{ signer: string; signature: string }>): string {
  if (!signatures.length) {
    throw new Error('No signatures provided for multi-sig transaction');
  }

  const sorted = [...signatures].sort((a, b) =>
    a.signer.toLowerCase().localeCompare(b.signer.toLowerCase())
  );

  const packed = sorted
    .map(({ signature }) => Signature.from(signature).serialized.replace(/^0x/, ''))
    .join('');

  return `0x${packed}`;
}

export const GNOSIS_FACTORY_ABI = MULTISIG_FACTORY_ABI;
export const GNOSIS_SAFE_ABI = MULTISIG_SAFE_ABI;
export { GUARDIAN_REGISTRY_ABI };

