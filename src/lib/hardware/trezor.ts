import TrezorConnect from 'trezor-connect';
import { appConfig } from '@/lib/config/app';

export class TrezorService {
  private initialized = false;

  /**
   * Initialize Trezor Connect
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await TrezorConnect.init({
        lazyLoad: false,
        manifest: {
          email: appConfig.app.supportEmail,
          appUrl: appConfig.app.url,
        },
      });
      this.initialized = true;
      console.log('Trezor Connect initialized');
    } catch (error) {
      console.error('Failed to initialize Trezor:', error);
      throw error;
    }
  }

  /**
   * Get Ethereum address from Trezor
   */
  async getEthereumAddress(path: string = "m/44'/60'/0'/0/0"): Promise<string> {
    await this.initialize();

    try {
      const result = await TrezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: false,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.address;
    } catch (error) {
      console.error('Failed to get Ethereum address:', error);
      throw error;
    }
  }

  /**
   * Get Bitcoin address from Trezor
   */
  async getBitcoinAddress(path: string = "m/44'/0'/0'/0/0"): Promise<string> {
    await this.initialize();

    try {
      const result = await TrezorConnect.getAddress({
        path,
        coin: 'btc',
        showOnTrezor: false,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.address;
    } catch (error) {
      console.error('Failed to get Bitcoin address:', error);
      throw error;
    }
  }

  /**
   * Sign Ethereum transaction with Trezor
   */
  async signEthTransaction(
    path: string,
    tx: {
      to: string;
      value: string;
      gasPrice: string;
      gasLimit: string;
      nonce: string;
      data?: string;
      chainId: number;
    }
  ): Promise<{ v: string; r: string; s: string }> {
    await this.initialize();

    try {
      const result = await TrezorConnect.ethereumSignTransaction({
        path,
        transaction: {
          to: tx.to,
          value: tx.value,
          gasPrice: tx.gasPrice,
          gasLimit: tx.gasLimit,
          nonce: tx.nonce,
          data: tx.data || '',
          chainId: tx.chainId,
        },
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return {
        v: result.payload.v,
        r: result.payload.r,
        s: result.payload.s,
      };
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  }

  /**
   * Sign message with Trezor
   */
  async signMessage(path: string, message: string): Promise<string> {
    await this.initialize();

    try {
      const result = await TrezorConnect.ethereumSignMessage({
        path,
        message,
        hex: false,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }

  /**
   * Sign Bitcoin transaction with Trezor
   */
  async signBitcoinTransaction(
    inputs: any[],
    outputs: any[],
    coin: string = 'btc'
  ): Promise<string> {
    await this.initialize();

    try {
      const result = await TrezorConnect.signTransaction({
        inputs,
        outputs,
        coin,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.serializedTx;
    } catch (error) {
      console.error('Failed to sign Bitcoin transaction:', error);
      throw error;
    }
  }

  /**
   * Get public key from Trezor
   */
  async getPublicKey(path: string, coin: string = 'btc'): Promise<string> {
    await this.initialize();

    try {
      const result = await TrezorConnect.getPublicKey({
        path,
        coin,
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.xpub;
    } catch (error) {
      console.error('Failed to get public key:', error);
      throw error;
    }
  }
}

export default new TrezorService();

