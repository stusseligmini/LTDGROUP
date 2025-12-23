/**
 * Telegram Bot API Client
 * 
 * Wrapper around Telegram Bot API with:
 * - Message queue
 * - Retry logic
 * - Rate limiting
 * - Error handling
 */

import type {
  SendMessageOptions,
  InlineKeyboardMarkup,
  BotCommand,
  TelegramUpdate,
} from './types';

interface QueuedMessage {
  options: SendMessageOptions;
  retries: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class TelegramBotClient {
  private botToken: string;
  private apiUrl: string;
  private messageQueue: QueuedMessage[] = [];
  private processing = false;
  private rateLimitDelay = 30; // ms between messages (33 msg/sec limit)
  
  constructor(botToken: string) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }
  
  /**
   * Send a text message
   */
  async sendMessage(options: SendMessageOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        options,
        retries: 0,
        resolve,
        reject,
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process message queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift();
      if (!item) break;
      
      try {
        const response = await fetch(`${this.apiUrl}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.options),
        });
        
        if (!response.ok) {
          const error = await response.json();
          
          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryAfter = error.parameters?.retry_after || 1;
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            
            // Re-queue the message
            if (item.retries < 3) {
              item.retries++;
              this.messageQueue.unshift(item);
            } else {
              item.reject(new Error('Rate limit exceeded after retries'));
            }
            continue;
          }
          
          throw new Error(error.description || 'API request failed');
        }
        
        const result = await response.json();
        item.resolve(result.result);
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
        
      } catch (error) {
        // Retry logic
        if (item.retries < 3) {
          item.retries++;
          this.messageQueue.unshift(item);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          item.reject(error);
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Edit a message
   */
  async editMessage(
    chatId: number | string,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<any> {
    const response = await fetch(`${this.apiUrl}/editMessageText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Failed to edit message');
    }
    
    return response.json();
  }
  
  /**
   * Answer callback query (inline button clicks)
   */
  async answerCallbackQuery(
    queryId: string,
    text?: string,
    showAlert = false
  ): Promise<void> {
    await fetch(`${this.apiUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: queryId,
        text,
        show_alert: showAlert,
      }),
    });
  }
  
  /**
   * Delete a message
   */
  async deleteMessage(chatId: number | string, messageId: number): Promise<void> {
    await fetch(`${this.apiUrl}/deleteMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });
  }
  
  /**
   * Set bot commands (menu)
   */
  async setCommands(commands: BotCommand[]): Promise<void> {
    await fetch(`${this.apiUrl}/setMyCommands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commands }),
    });
  }
  
  /**
   * Set webhook
   */
  async setWebhook(url: string, secretToken?: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Failed to set webhook');
    }
  }
  
  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/getWebhookInfo`);
    const data = await response.json();
    return data.result;
  }
  
  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<void> {
    await fetch(`${this.apiUrl}/deleteWebhook`, {
      method: 'POST',
    });
  }
  
  /**
   * Send photo
   */
  async sendPhoto(
    chatId: number | string,
    photo: Buffer | string,
    caption?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    
    if (Buffer.isBuffer(photo)) {
      // Convert Buffer to ArrayBuffer for Blob
      const arrayBuffer = photo.buffer.slice(photo.byteOffset, photo.byteOffset + photo.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      formData.append('photo', blob, 'photo.png');
    } else {
      formData.append('photo', photo);
    }
    
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');
    }
    
    const response = await fetch(`${this.apiUrl}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Failed to send photo');
    }
    
    return response.json();
  }
  
  /**
   * Get bot info
   */
  async getMe(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/getMe`);
    const data = await response.json();
    return data.result;
  }
  
  /**
   * Verify webhook signature (if using secret token)
   */
  verifyWebhook(body: string, signature: string, secretToken: string): boolean {
    // In production, implement HMAC verification
    return signature === secretToken;
  }
}

