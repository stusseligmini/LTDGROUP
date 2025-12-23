/**
 * Firestore Database Operations
 * Wallet data sync between extension and Telegram
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './client';

// Types
export interface FirebaseWallet {
  id: string;
  userId: string;
  telegramId?: string;
  blockchain: string;
  address: string;
  publicKey?: string;
  label?: string;
  isDefault: boolean;
  isHidden: boolean;
  balanceCache?: string;
  balanceFiat?: number;
  fiatCurrency?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirebaseTransaction {
  id: string;
  walletId: string;
  userId: string;
  txHash: string;
  blockchain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenSymbol?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Timestamp;
  memo?: string;
}

export interface UserSettings {
  userId: string;
  telegramId?: string;
  telegramUsername?: string;
  notifications: {
    telegram: boolean;
    push: boolean;
  };
  defaultCurrency: string;
  language: string;
  updatedAt: Timestamp;
}

// Collections
const USERS_COLLECTION = 'users';
const WALLETS_COLLECTION = 'wallets';
const TRANSACTIONS_COLLECTION = 'transactions';
const SETTINGS_COLLECTION = 'settings';

/**
 * Get user's wallets
 */
export async function getUserWallets(userId: string): Promise<FirebaseWallet[]> {
  const walletsRef = collection(db, USERS_COLLECTION, userId, WALLETS_COLLECTION);
  const q = query(walletsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FirebaseWallet[];
}

/**
 * Get specific wallet
 */
export async function getWallet(userId: string, walletId: string): Promise<FirebaseWallet | null> {
  const walletRef = doc(db, USERS_COLLECTION, userId, WALLETS_COLLECTION, walletId);
  const snapshot = await getDoc(walletRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as FirebaseWallet;
}

/**
 * Create new wallet
 */
export async function createWallet(
  userId: string,
  walletData: Omit<FirebaseWallet, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<FirebaseWallet> {
  const walletRef = doc(collection(db, USERS_COLLECTION, userId, WALLETS_COLLECTION));
  
  const newWallet: Omit<FirebaseWallet, 'id'> = {
    ...walletData,
    userId,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  
  await setDoc(walletRef, newWallet);
  
  return {
    id: walletRef.id,
    ...newWallet,
  } as FirebaseWallet;
}

/**
 * Update wallet
 */
export async function updateWallet(
  userId: string,
  walletId: string,
  updates: Partial<Omit<FirebaseWallet, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  const walletRef = doc(db, USERS_COLLECTION, userId, WALLETS_COLLECTION, walletId);
  
  await updateDoc(walletRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete wallet
 */
export async function deleteWallet(userId: string, walletId: string): Promise<void> {
  const walletRef = doc(db, USERS_COLLECTION, userId, WALLETS_COLLECTION, walletId);
  await deleteDoc(walletRef);
}

/**
 * Get wallet transactions
 */
export async function getWalletTransactions(
  userId: string,
  walletId: string,
  maxResults: number = 50
): Promise<FirebaseTransaction[]> {
  const txRef = collection(db, USERS_COLLECTION, userId, TRANSACTIONS_COLLECTION);
  const q = query(
    txRef,
    where('walletId', '==', walletId),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FirebaseTransaction[];
}

/**
 * Add transaction
 */
export async function addTransaction(
  userId: string,
  transactionData: Omit<FirebaseTransaction, 'id' | 'userId'>
): Promise<FirebaseTransaction> {
  const txRef = doc(collection(db, USERS_COLLECTION, userId, TRANSACTIONS_COLLECTION));
  
  const newTransaction: Omit<FirebaseTransaction, 'id'> = {
    ...transactionData,
    userId,
  };
  
  await setDoc(txRef, newTransaction);
  
  return {
    id: txRef.id,
    ...newTransaction,
  } as FirebaseTransaction;
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const settingsRef = doc(db, USERS_COLLECTION, userId, SETTINGS_COLLECTION, 'preferences');
  const snapshot = await getDoc(settingsRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as UserSettings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  settings: Partial<Omit<UserSettings, 'userId'>>
): Promise<void> {
  const settingsRef = doc(db, USERS_COLLECTION, userId, SETTINGS_COLLECTION, 'preferences');
  
  await setDoc(settingsRef, {
    ...settings,
    userId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId: string): Promise<string | null> {
  const usersRef = collection(db, USERS_COLLECTION);
  const q = query(usersRef, where('telegramId', '==', telegramId), limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].id;
}

/**
 * Link Telegram ID to user
 */
export async function linkTelegramToUser(userId: string, telegramId: string, username?: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  
  await setDoc(userRef, {
    telegramId,
    telegramUsername: username,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
