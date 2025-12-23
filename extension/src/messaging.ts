/**
 * Secure messaging utilities for extension
 * 
 * Type-safe message passing between popup, background, and content scripts
 */

export enum MessageType {
  GET_WALLET_DATA = 'GET_WALLET_DATA',
  WALLET_DATA_RESPONSE = 'WALLET_DATA_RESPONSE',
  GET_NOTIFICATIONS = 'GET_NOTIFICATIONS',
  NOTIFICATIONS_RESPONSE = 'NOTIFICATIONS_RESPONSE',
  SIGN_TRANSACTION = 'SIGN_TRANSACTION',
  TRANSACTION_SIGNED = 'TRANSACTION_SIGNED',
  CONNECT_WALLET = 'CONNECT_WALLET',
  WALLET_CONNECTED = 'WALLET_CONNECTED',
  DISCONNECT_WALLET = 'DISCONNECT_WALLET',
  WALLET_DISCONNECTED = 'WALLET_DISCONNECTED',
  ERROR = 'ERROR',
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

export interface ErrorMessage {
  type: MessageType.ERROR;
  error: string;
  requestId?: string;
}

export interface WalletDataRequest {
  type: MessageType.GET_WALLET_DATA;
  requestId?: string;
}

export interface WalletDataResponse {
  type: MessageType.WALLET_DATA_RESPONSE;
  data: {
    totalBalance: number;
    addresses: Array<{
      blockchain: string;
      address: string;
      balance: number;
    }>;
  };
  requestId?: string;
}

export interface NotificationsRequest {
  type: MessageType.GET_NOTIFICATIONS;
  payload?: {
    limit?: number;
    unreadOnly?: boolean;
  };
  requestId?: string;
}

export interface NotificationsResponse {
  type: MessageType.NOTIFICATIONS_RESPONSE;
  data: {
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
      createdAt: string;
    }>;
  };
  requestId?: string;
}

export interface SignTransactionRequest {
  type: MessageType.SIGN_TRANSACTION;
  payload: {
    transaction: string;
    metadata?: {
      recipient?: string;
      amount?: number;
      currency?: string;
    };
  };
  requestId?: string;
}

export interface TransactionSignedResponse {
  type: MessageType.TRANSACTION_SIGNED;
  signature: string;
  requestId?: string;
}

/**
 * Send a message to the background service worker
 */
export async function sendToBackground<T, R>(
  message: Message<T>
): Promise<R> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const messageWithId = { ...message, requestId };

    // Set timeout for response
    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, 30000);

    chrome.runtime.sendMessage(messageWithId, (response: Message<R> | ErrorMessage) => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response received'));
        return;
      }

      if (response.type === MessageType.ERROR) {
        reject(new Error((response as ErrorMessage).error));
        return;
      }

      if (response.requestId !== requestId) {
        reject(new Error('Request ID mismatch'));
        return;
      }

      resolve((response as Message<R>).payload as R);
    });
  });
}

/**
 * Send a message to a specific tab
 */
export async function sendToTab<T, R>(
  tabId: number,
  message: Message<T>
): Promise<R> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const messageWithId = { ...message, requestId };

    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, 30000);

    chrome.tabs.sendMessage(tabId, messageWithId, (response: Message<R> | ErrorMessage) => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response received'));
        return;
      }

      if (response.type === MessageType.ERROR) {
        reject(new Error((response as ErrorMessage).error));
        return;
      }

      if (response.requestId !== requestId) {
        reject(new Error('Request ID mismatch'));
        return;
      }

      resolve((response as Message<R>).payload as R);
    });
  });
}

/**
 * Broadcast a message to all tabs
 */
export async function broadcastToTabs<T>(message: Message<T>): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const promises = tabs.map((tab) => {
    if (tab.id) {
      return chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Ignore errors for tabs that don't have content script
      });
    }
  });
  await Promise.all(promises);
}

/**
 * Listen for messages from background or content scripts
 */
export function onMessage<T, R>(
  handler: (
    message: Message<T>,
    sender: chrome.runtime.MessageSender
  ) => Promise<R> | R
): void {
  chrome.runtime.onMessage.addListener(
    (
      message: Message<T>,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: Message<R> | ErrorMessage) => void
    ) => {
      // Validate message structure
      if (!message || !message.type) {
        sendResponse({
          type: MessageType.ERROR,
          error: 'Invalid message format',
          requestId: message?.requestId,
        });
        return false;
      }

      // Handle message asynchronously
      Promise.resolve(handler(message, sender))
        .then((result) => {
          sendResponse({
            type: message.type,
            payload: result,
            requestId: message.requestId,
          });
        })
        .catch((error) => {
          sendResponse({
            type: MessageType.ERROR,
            error: error.message,
            requestId: message.requestId,
          });
        });

      // Return true to indicate async response
      return true;
    }
  );
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Type guards
 */
export function isWalletDataResponse(
  message: Message
): message is WalletDataResponse {
  return message.type === MessageType.WALLET_DATA_RESPONSE;
}

export function isNotificationsResponse(
  message: Message
): message is NotificationsResponse {
  return message.type === MessageType.NOTIFICATIONS_RESPONSE;
}

export function isTransactionSignedResponse(
  message: Message
): message is TransactionSignedResponse {
  return message.type === MessageType.TRANSACTION_SIGNED;
}

export function isErrorMessage(message: Message): message is ErrorMessage {
  return message.type === MessageType.ERROR;
}
