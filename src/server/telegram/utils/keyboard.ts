/**
 * Telegram Inline Keyboard Utilities
 */

import type { InlineKeyboardMarkup, InlineKeyboardButton } from '../types';

/**
 * Create a simple inline keyboard with one row of buttons
 */
export function createInlineKeyboard(buttons: InlineKeyboardButton[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: [buttons],
  };
}

/**
 * Create a keyboard with multiple rows
 */
export function createKeyboardGrid(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows,
  };
}

/**
 * Create a button
 */
export function button(text: string, callbackData: string): InlineKeyboardButton {
  return {
    text,
    callback_data: callbackData,
  };
}

/**
 * Create a URL button
 */
export function urlButton(text: string, url: string): InlineKeyboardButton {
  return {
    text,
    url,
  };
}

/**
 * Common keyboard layouts
 */
export const keyboards = {
  // Main menu
  mainMenu: (): InlineKeyboardMarkup => createKeyboardGrid([
    [button('💰 Balance', 'menu:balance'), button('💳 Cards', 'menu:cards')],
    [button('📤 Send', 'menu:send'), button('📥 Receive', 'menu:receive')],
    [button('📊 History', 'menu:history'), button('⚙️ Settings', 'menu:settings')],
  ]),
  
  // Balance actions
  balanceActions: (): InlineKeyboardMarkup => createKeyboardGrid([
    [button('🔄 Refresh', 'balance:refresh')],
    [button('« Back', 'menu:main')],
  ]),
  
  // Card list actions
  cardActions: (cardId: string): InlineKeyboardMarkup => createKeyboardGrid([
    [button('❄️ Freeze', `card:freeze:${cardId}`), button('👁️ View Details', `card:details:${cardId}`)],
    [button('« Back', 'menu:cards')],
  ]),
  
  // Card frozen actions
  cardFrozenActions: (cardId: string): InlineKeyboardMarkup => createKeyboardGrid([
    [button('🔥 Unfreeze', `card:unfreeze:${cardId}`), button('👁️ View Details', `card:details:${cardId}`)],
    [button('« Back', 'menu:cards')],
  ]),
  
  // Confirmation dialogs
  confirmSend: (amount: string, address: string): InlineKeyboardMarkup => createKeyboardGrid([
    [button('✅ Confirm', `send:confirm`), button('❌ Cancel', `send:cancel`)],
  ]),
  
  // Chain selection
  chainSelector: (): InlineKeyboardMarkup => createKeyboardGrid([
    [button('⚡ Solana', 'chain:solana'), button('🔷 Ethereum', 'chain:ethereum')],
    [button('₿ Bitcoin', 'chain:bitcoin'), button('🌿 Celo', 'chain:celo')],
    [button('« Cancel', 'menu:main')],
  ]),
  
  // Back button
  backButton: (action: string): InlineKeyboardMarkup => createInlineKeyboard([
    button('« Back', action),
  ]),
  
  // Cancel button
  cancelButton: (): InlineKeyboardMarkup => createInlineKeyboard([
    button('❌ Cancel', 'cancel'),
  ]),
};

