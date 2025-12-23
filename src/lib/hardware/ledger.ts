import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';
import Solana from '@ledgerhq/hw-app-solana';

export interface LedgerDevice {
  transport: any;
  eth?: InstanceType<typeof Eth>;
  solana?: InstanceType<typeof Solana>;
}

export class LedgerService {
  private device: LedgerDevice | null = null;

  /**
   * Check if Ledger is supported in current browser
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /**
   * Connect to Ledger device
   */
  async connect(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Ledger not supported in this browser. Use Chrome, Edge, or Opera.');
    }

    try {
      const transport = await TransportWebUSB.create();
      this.device = { transport };
      console.log('Ledger connected successfully');
    } catch (error) {
      console.error('Failed to connect to Ledger:', error);
      throw new Error('Failed to connect to Ledger. Make sure device is unlocked.');
    }
  }

  /**
   * Disconnect from Ledger device
   */
  async disconnect(): Promise<void> {
    if (this.device?.transport) {
      await this.device.transport.close();
      this.device = null;
    }
  }

  /**
   * Get Ethereum address from Ledger
   */
  async getEthereumAddress(path: string = "44'/60'/0'/0/0"): Promise<string> {
    if (!this.device) {
      throw new Error('Ledger not connected');
    }

    try {
      if (!this.device.eth) {
        this.device.eth = new Eth(this.device.transport);
      }

      const result = await this.device.eth.getAddress(path, false);
      return result.address;
    } catch (error) {
      console.error('Failed to get Ethereum address:', error);
      throw new Error('Failed to get address from Ledger');
    }
  }

  /**
   * Get Solana address from Ledger
   */
  async getSolanaAddress(path: string = "44'/501'/0'/0'"): Promise<string> {
    if (!this.device) {
      throw new Error('Ledger not connected');
    }

    try {
      if (!this.device.solana) {
        this.device.solana = new Solana(this.device.transport);
      }

      const result = await this.device.solana.getAddress(path);
      return result.address;
    } catch (error) {
      console.error('Failed to get Solana address:', error);
      throw new Error('Failed to get address from Ledger');
    }
  }

  /**
   * Sign Ethereum transaction with Ledger
   */
  async signEthTransaction(
    path: string,
    rawTx: string
  ): Promise<{ v: string; r: string; s: string }> {
    if (!this.device?.eth) {
      throw new Error('Ledger Ethereum app not initialized');
    }

    try {
      const signature = await this.device.eth.signTransaction(path, rawTx);
      return signature;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw new Error('Transaction signing rejected or failed');
    }
  }

  /**
   * Sign Solana transaction with Ledger
   */
  async signSolanaTransaction(
    path: string,
    txBuffer: Buffer
  ): Promise<Buffer> {
    if (!this.device?.solana) {
      throw new Error('Ledger Solana app not initialized');
    }

    try {
      const signature = await this.device.solana.signTransaction(path, txBuffer);
      return signature.signature;
    } catch (error) {
      console.error('Failed to sign Solana transaction:', error);
      throw new Error('Transaction signing rejected or failed');
    }
  }

  /**
   * Sign message with Ledger
   */
  async signMessage(path: string, message: string): Promise<string> {
    if (!this.device?.eth) {
      throw new Error('Ledger Ethereum app not initialized');
    }

    try {
      const result = await this.device.eth.signPersonalMessage(
        path,
        Buffer.from(message).toString('hex')
      );
      
      const v = parseInt(result.v, 10);
      const signature = `0x${result.r}${result.s}${v.toString(16)}`;
      return signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw new Error('Message signing rejected or failed');
    }
  }
}

export default new LedgerService();

