import * as Keychain from 'react-native-keychain';

/**
 * Secure storage service using native Keychain/Keystore
 */
class SecureStorage {
  /**
   * Store a value securely
   */
  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword(key, value, {
        service: key,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return true;
    } catch (error) {
      console.error('Error storing secure item:', error);
      return false;
    }
  }

  /**
   * Retrieve a value securely
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: key,
      });
      
      if (credentials) {
        return credentials.password;
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      return null;
    }
  }

  /**
   * Remove a value from secure storage
   */
  async removeItem(key: string): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({
        service: key,
      });
      return true;
    } catch (error) {
      console.error('Error removing secure item:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is supported
   */
  async isBiometricSupported(): Promise<boolean> {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch (error) {
      console.error('Error checking biometric support:', error);
      return false;
    }
  }

  /**
   * Store with biometric authentication
   */
  async setItemWithBiometric(key: string, value: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword(key, value, {
        service: key,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        authenticationType: Keychain.AUTHENTICATION_TYPE.BIOMETRICS,
      });
      return true;
    } catch (error) {
      console.error('Error storing with biometric:', error);
      return false;
    }
  }

  /**
   * Retrieve with biometric authentication
   */
  async getItemWithBiometric(key: string, promptMessage: string = 'Authenticate to access'): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: key,
        authenticationPrompt: {
          title: 'Authentication Required',
          subtitle: promptMessage,
        },
      });
      
      if (credentials) {
        return credentials.password;
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving with biometric:', error);
      return null;
    }
  }
}

export default new SecureStorage();

