import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FCM_TOKEN_KEY = 'fcm_token';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private onNotificationCallback?: (notification: NotificationPayload) => void;
  private onTokenRefreshCallback?: (token: string) => void;

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    // Request permission
    await this.requestPermission();

    // Get FCM token
    await this.getFCMToken();

    // Set up listeners
    this.setupNotificationListeners();
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Push notification permission granted:', authStatus);
      }

      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token for the device
   */
  async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      
      if (token) {
        console.log('FCM Token:', token);
        await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
        
        // Send token to backend
        await this.sendTokenToBackend(token);
      }

      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners(): void {
    // Foreground message handler
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification received:', remoteMessage);
      
      if (remoteMessage.notification && this.onNotificationCallback) {
        this.onNotificationCallback({
          title: remoteMessage.notification.title || '',
          body: remoteMessage.notification.body || '',
          data: remoteMessage.data as Record<string, string>,
        });
      }
    });

    // Background/Quit message handler
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification received:', remoteMessage);
    });

    // Notification opened app handler
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      // Handle navigation based on notification data
    });

    // Check if app was opened by notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened by notification:', remoteMessage);
        }
      });

    // Token refresh listener
    messaging().onTokenRefresh(async (token) => {
      console.log('FCM token refreshed:', token);
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
      
      if (this.onTokenRefreshCallback) {
        this.onTokenRefreshCallback(token);
      }
      
      // Send new token to backend
      await this.sendTokenToBackend(token);
    });
  }

  /**
   * Send FCM token to backend
   */
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      // Get auth token
      const authToken = await AsyncStorage.getItem('auth_token');
      if (!authToken) {
        console.log('No auth token, skipping token registration');
        return;
      }

      // Send to backend API
      const response = await fetch(process.env.API_BASE_URL + '/api/notifications/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          deviceType: 'mobile',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register FCM token');
      }

      console.log('FCM token registered successfully');
    } catch (error) {
      console.error('Error sending FCM token to backend:', error);
    }
  }

  /**
   * Subscribe to notification events
   */
  onNotification(callback: (notification: NotificationPayload) => void): void {
    this.onNotificationCallback = callback;
  }

  /**
   * Subscribe to token refresh events
   */
  onTokenRefresh(callback: (token: string) => void): void {
    this.onTokenRefreshCallback = callback;
  }

  /**
   * Get stored FCM token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(FCM_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting stored FCM token:', error);
      return null;
    }
  }

  /**
   * Delete FCM token (logout)
   */
  async deleteToken(): Promise<void> {
    try {
      await messaging().deleteToken();
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      console.log('FCM token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }
}

export default new PushNotificationService();

