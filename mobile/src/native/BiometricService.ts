import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

export interface BiometricResult {
  success: boolean;
  error?: string;
}

export interface BiometricCapabilities {
  available: boolean;
  biometryType: BiometryTypes | null;
  error?: string;
}

class BiometricService {
  /**
   * Check if biometric authentication is available
   */
  async isBiometricAvailable(): Promise<BiometricCapabilities> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      return {
        available,
        biometryType,
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        available: false,
        biometryType: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(promptMessage: string = 'Authenticate to continue'): Promise<BiometricResult> {
    try {
      const { success } = await rnBiometrics.simplePrompt({ promptMessage });
      
      return {
        success,
      };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Create biometric keys for encryption
   */
  async createKeys(): Promise<BiometricResult> {
    try {
      const { publicKey } = await rnBiometrics.createKeys();
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error creating biometric keys:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Key creation failed',
      };
    }
  }

  /**
   * Delete biometric keys
   */
  async deleteKeys(): Promise<BiometricResult> {
    try {
      await rnBiometrics.deleteKeys();
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting biometric keys:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Key deletion failed',
      };
    }
  }

  /**
   * Create a signature with biometric authentication
   */
  async createSignature(payload: string, promptMessage: string = 'Sign to continue'): Promise<BiometricResult & { signature?: string }> {
    try {
      const { success, signature } = await rnBiometrics.createSignature({
        promptMessage,
        payload,
      });
      
      return {
        success,
        signature,
      };
    } catch (error) {
      console.error('Error creating signature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signature creation failed',
      };
    }
  }
}

export default new BiometricService();

