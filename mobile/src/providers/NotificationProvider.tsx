import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import PushNotificationService, { NotificationPayload } from '../native/PushNotificationService';

interface NotificationContextType {
  initialize: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  useEffect(() => {
    initializeNotifications();
  }, []);

  const initializeNotifications = async () => {
    try {
      await PushNotificationService.initialize();

      // Set up notification listener
      PushNotificationService.onNotification(handleNotification);

      // Set up token refresh listener
      PushNotificationService.onTokenRefresh(handleTokenRefresh);
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const handleNotification = (notification: NotificationPayload) => {
    console.log('Received notification:', notification);
    // Handle notification display (could use a toast/alert library)
  };

  const handleTokenRefresh = (token: string) => {
    console.log('Token refreshed:', token);
    // Token is automatically sent to backend by the service
  };

  return (
    <NotificationContext.Provider value={{ initialize: initializeNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

