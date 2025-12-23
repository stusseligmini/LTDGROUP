import { PermissionsAndroid, Platform } from 'react-native';

export interface QRCodeScanResult {
  data: string;
  type: string;
}

class CameraService {
  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Celora needs access to your camera to scan QR codes',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Error requesting camera permission:', err);
        return false;
      }
    }
    // iOS permissions are handled in Info.plist
    return true;
  }

  /**
   * Parse QR code data to extract wallet address
   */
  parseQRCode(data: string): { address: string; amount?: string; memo?: string; blockchain?: string } | null {
    try {
      // Handle different QR code formats

      // Bitcoin: bitcoin:address?amount=0.1&message=memo
      if (data.startsWith('bitcoin:')) {
        const url = new URL(data);
        return {
          address: url.pathname,
          amount: url.searchParams.get('amount') || undefined,
          memo: url.searchParams.get('message') || undefined,
          blockchain: 'bitcoin',
        };
      }

      // Ethereum: ethereum:address@chainId?value=amount
      if (data.startsWith('ethereum:')) {
        const match = data.match(/ethereum:([^@?]+)(@\d+)?/);
        if (match) {
          return {
            address: match[1],
            blockchain: 'ethereum',
          };
        }
      }

      // Solana: solana:address?amount=1.5&label=memo
      if (data.startsWith('solana:')) {
        const url = new URL(data);
        return {
          address: url.pathname,
          amount: url.searchParams.get('amount') || undefined,
          memo: url.searchParams.get('label') || url.searchParams.get('memo') || undefined,
          blockchain: 'solana',
        };
      }

      // Plain address (no protocol)
      // Try to detect blockchain by address format
      if (/^0x[a-fA-F0-9]{40}$/.test(data)) {
        // Ethereum-like address
        return { address: data, blockchain: 'ethereum' };
      } else if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(data)) {
        // Bitcoin address
        return { address: data, blockchain: 'bitcoin' };
      } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data)) {
        // Solana address
        return { address: data, blockchain: 'solana' };
      }

      // Plain address without protocol detection
      return { address: data };
    } catch (error) {
      console.error('Error parsing QR code:', error);
      return null;
    }
  }

  /**
   * Validate wallet address format
   */
  isValidAddress(address: string, blockchain?: string): boolean {
    if (!blockchain) {
      // Check if it's valid for any blockchain
      return (
        /^0x[a-fA-F0-9]{40}$/.test(address) || // Ethereum
        /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || // Bitcoin
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) // Solana
      );
    }

    switch (blockchain.toLowerCase()) {
      case 'ethereum':
      case 'celo':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'bitcoin':
        return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
      case 'solana':
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      default:
        return false;
    }
  }
}

export default new CameraService();

