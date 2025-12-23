export type HardwareWalletType = 'ledger' | 'trezor';

export interface HardwareWalletInfo {
  type: HardwareWalletType;
  connected: boolean;
  address?: string;
  publicKey?: string;
  derivationPath?: string;
}

export interface SignTransactionRequest {
  to: string;
  value: string;
  data?: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: string;
  chainId?: number;
}

export interface HardwareWalletProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(path: string, blockchain: string): Promise<string>;
  signTransaction(path: string, tx: any): Promise<any>;
  signMessage(path: string, message: string): Promise<string>;
}

