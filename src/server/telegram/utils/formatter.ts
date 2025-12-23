/**
 * Telegram Message Formatting Utilities
 */

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format crypto amount
 */
export function formatCrypto(amount: string | number, symbol: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toFixed(8)} ${symbol}`;
}

/**
 * Format address (shortened)
 */
export function formatAddress(address: string, length: number = 8): string {
  if (address.length <= length * 2) {
    return address;
  }
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Format date/time
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format card number (masked)
 */
export function formatCardNumber(lastFour: string): string {
  return `**** **** **** ${lastFour}`;
}

/**
 * Escape Markdown special characters
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Bold text
 */
export function bold(text: string): string {
  return `*${escapeMarkdown(text)}*`;
}

/**
 * Italic text
 */
export function italic(text: string): string {
  return `_${escapeMarkdown(text)}_`;
}

/**
 * Code text
 */
export function code(text: string): string {
  return `\`${text}\``;
}

/**
 * Code block
 */
export function codeBlock(text: string, language: string = ''): string {
  return `\`\`\`${language}\n${text}\n\`\`\``;
}

/**
 * Link
 */
export function link(text: string, url: string): string {
  return `[${escapeMarkdown(text)}](${url})`;
}

/**
 * Build a formatted balance message
 */
export function formatBalanceMessage(balances: Array<{ symbol: string; amount: string; fiatValue: number }>): string {
  let message = `${bold('Your Balances')}\n\n`;
  
  let totalFiat = 0;
  for (const balance of balances) {
    message += `${balance.symbol}: ${formatCrypto(balance.amount, balance.symbol)}\n`;
    message += `≈ ${formatCurrency(balance.fiatValue, 'USD')}\n\n`;
    totalFiat += balance.fiatValue;
  }
  
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `${bold('Total')}: ${formatCurrency(totalFiat, 'USD')}`;
  
  return message;
}

/**
 * Format transaction details
 */
export function formatTransaction(tx: {
  hash: string;
  from: string;
  to: string;
  amount: string;
  symbol: string;
  date: Date;
  status: string;
}): string {
  let message = `${bold('Transaction Details')}\n\n`;
  message += `From: ${code(formatAddress(tx.from))}\n`;
  message += `To: ${code(formatAddress(tx.to))}\n`;
  message += `Amount: ${formatCrypto(tx.amount, tx.symbol)}\n`;
  message += `Status: ${tx.status}\n`;
  message += `Date: ${formatDateTime(tx.date)}\n\n`;
  message += `Hash: ${code(formatAddress(tx.hash, 12))}`;
  
  return message;
}

/**
 * Format card details
 */
export function formatCard(card: {
  nickname?: string;
  lastFour: string;
  brand: string;
  status: string;
  expiryMonth: number;
  expiryYear: number;
  monthlySpent: number;
  monthlyLimit?: number;
}): string {
  let message = `${bold(card.nickname || `${card.brand} Card`)}\n\n`;
  message += `Card: ${formatCardNumber(card.lastFour)}\n`;
  message += `Status: ${card.status === 'active' ? '✅ Active' : card.status === 'frozen' ? '❄️ Frozen' : '🚫 Cancelled'}\n`;
  message += `Expires: ${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}\n\n`;
  
  if (card.monthlyLimit) {
    message += `Monthly: ${formatCurrency(card.monthlySpent)} / ${formatCurrency(card.monthlyLimit)}\n`;
    const percentage = (card.monthlySpent / card.monthlyLimit) * 100;
    message += `Progress: ${percentage.toFixed(1)}%`;
  } else {
    message += `Spent this month: ${formatCurrency(card.monthlySpent)}`;
  }
  
  return message;
}

/**
 * Format error message
 */
export function formatError(error: string): string {
  return `❌ ${bold('Error')}\n\n${escapeMarkdown(error)}`;
}

/**
 * Format success message
 */
export function formatSuccess(message: string): string {
  return `✅ ${bold('Success')}\n\n${escapeMarkdown(message)}`;
}

/**
 * Format warning message
 */
export function formatWarning(message: string): string {
  return `⚠️ ${bold('Warning')}\n\n${escapeMarkdown(message)}`;
}

