/**
 * QR Code Generator for Payment Requests
 * Supports EIP-681 (Ethereum), BIP-21 (Bitcoin), and other formats
 */

import * as QRCode from 'qrcode';

export interface PaymentRequest {
  address: string;
  amount?: string;
  token?: string;
  memo?: string;
  chainId?: number;
}

/**
 * Generate EIP-681 URI for Ethereum-based chains
 * Format: ethereum:<address>[@<chainId>][?value=<amount>&gas=<gas>]
 */
export function generateEIP681URI(request: PaymentRequest): string {
  let uri = `ethereum:${request.address}`;
  
  if (request.chainId) {
    uri += `@${request.chainId}`;
  }
  
  const params = new URLSearchParams();
  if (request.amount) {
    params.append('value', request.amount);
  }
  if (request.token) {
    params.append('token', request.token);
  }
  
  const queryString = params.toString();
  if (queryString) {
    uri += `?${queryString}`;
  }
  
  return uri;
}

/**
 * Generate BIP-21 URI for Bitcoin
 * Format: bitcoin:<address>[?amount=<amount>&label=<label>&message=<message>]
 */
export function generateBIP21URI(request: PaymentRequest): string {
  let uri = `bitcoin:${request.address}`;
  
  const params = new URLSearchParams();
  if (request.amount) {
    params.append('amount', request.amount);
  }
  if (request.memo) {
    params.append('message', request.memo);
  }
  
  const queryString = params.toString();
  if (queryString) {
    uri += `?${queryString}`;
  }
  
  return uri;
}

/**
 * Generate Solana pay URI
 * Format: solana:<address>[?amount=<amount>&spl-token=<mint>&memo=<memo>]
 */
export function generateSolanaURI(request: PaymentRequest): string {
  let uri = `solana:${request.address}`;
  
  const params = new URLSearchParams();
  if (request.amount) {
    params.append('amount', request.amount);
  }
  if (request.token) {
    params.append('spl-token', request.token);
  }
  if (request.memo) {
    params.append('memo', request.memo);
  }
  
  const queryString = params.toString();
  if (queryString) {
    uri += `?${queryString}`;
  }
  
  return uri;
}

/**
 * Generate QR code as data URL
 */
export async function generateQRCodeDataURL(
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
): Promise<string> {
  return QRCode.toDataURL(data, {
    width: options?.width || 512,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
  });
}

/**
 * Generate QR code as buffer (for sending via Telegram)
 */
export async function generateQRCodeBuffer(
  data: string,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }
): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    width: options?.width || 512,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
  });
}

/**
 * Generate payment QR code based on blockchain
 */
export async function generatePaymentQR(
  blockchain: string,
  request: PaymentRequest
): Promise<{
  uri: string;
  dataURL: string;
}> {
  let uri: string;
  
  switch (blockchain.toLowerCase()) {
    case 'ethereum':
    case 'celo':
      uri = generateEIP681URI(request);
      break;
    case 'bitcoin':
      uri = generateBIP21URI(request);
      break;
    case 'solana':
      uri = generateSolanaURI(request);
      break;
    default:
      // Fallback to just the address
      uri = request.address;
  }
  
  const dataURL = await generateQRCodeDataURL(uri);
  
  return { uri, dataURL };
}

