/**
 * Database Seeding Script
 * 
 * Populates database with realistic development data:
 * - Test users
 * - Sample wallets (Celo, Ethereum, Bitcoin, Solana)
 * - Transaction history
 * - Notifications
 * 
 * Usage:
 *   npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (dev only!)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.notification.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.session.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.rateLimit.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Cleanup complete\n');
  }

  // Create test users
  console.log('👤 Creating test users...');
  
  const user1 = await prisma.user.create({
    data: {
      email: 'alice@celora.io',
      emailVerified: true,
      displayName: 'Alice Johnson',
      phoneNumber: '+4798765432',
      twoFactorEnabled: true,
      lastLoginAt: new Date(),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'bob@celora.io',
      emailVerified: true,
      displayName: 'Bob Smith',
      phoneNumber: '+4712345678',
      twoFactorEnabled: false,
      lastLoginAt: new Date(Date.now() - 86400000), // Yesterday
    },
  });

  console.log(`✅ Created users: ${user1.email}, ${user2.email}\n`);

  // Create wallets for Alice
  console.log('💰 Creating wallets...');
  
  const celoWallet = await prisma.wallet.create({
    data: {
      userId: user1.id,
      blockchain: 'celo',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      publicKey: '0x04b5c8f8e9d3...',
      balanceCache: '5000000000000000000', // 5 CELO in wei
      balanceFiat: 7.50,
      fiatCurrency: 'USD',
      label: 'Main Celo Wallet',
      isDefault: true,
      derivationPath: "m/44'/52752'/0'/0/0",
      lastSyncedAt: new Date(),
    },
  });

  const ethWallet = await prisma.wallet.create({
    data: {
      userId: user1.id,
      blockchain: 'ethereum',
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      publicKey: '0x04a7b9c2d1...',
      balanceCache: '2000000000000000000', // 2 ETH in wei
      balanceFiat: 6800.00,
      fiatCurrency: 'USD',
      label: 'Ethereum Wallet',
      isDefault: false,
      derivationPath: "m/44'/60'/0'/0/0",
      lastSyncedAt: new Date(),
    },
  });

  const btcWallet = await prisma.wallet.create({
    data: {
      userId: user2.id,
      blockchain: 'bitcoin',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      publicKey: '0x02e5c9a3...',
      balanceCache: '50000000', // 0.5 BTC in satoshis
      balanceFiat: 45000.00,
      fiatCurrency: 'USD',
      label: 'Bitcoin Cold Storage',
      isDefault: true,
      isHardware: true,
      derivationPath: "m/84'/0'/0'/0/0",
      lastSyncedAt: new Date(),
    },
  });

  const solWallet = await prisma.wallet.create({
    data: {
      userId: user2.id,
      blockchain: 'solana',
      address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      publicKey: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      balanceCache: '100000000000', // 100 SOL in lamports
      balanceFiat: 9900.00,
      fiatCurrency: 'USD',
      label: 'Solana Trading',
      isDefault: false,
      derivationPath: "m/44'/501'/0'/0'",
      lastSyncedAt: new Date(),
    },
  });

  console.log(`✅ Created ${4} wallets\n`);

  // Create transactions
  console.log('📊 Creating transaction history...');
  
  const transactions = await prisma.transaction.createMany({
    data: [
      {
        walletId: celoWallet.id,
        txHash: '0x8f9a7b2c1d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
        blockchain: 'celo',
        blockNumber: BigInt(12345678),
        fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
        toAddress: celoWallet.address,
        amount: '1000000000000000000', // 1 CELO
        tokenSymbol: 'CELO',
        gasFee: '21000000000000',
        status: 'confirmed',
        confirmations: 120,
        type: 'receive',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        walletId: ethWallet.id,
        txHash: '0x7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d',
        blockchain: 'ethereum',
        blockNumber: BigInt(18500000),
        fromAddress: ethWallet.address,
        toAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        amount: '500000000000000000', // 0.5 ETH
        tokenSymbol: 'ETH',
        gasFee: '420000000000000',
        gasPrice: '20000000000',
        gasUsed: '21000',
        status: 'confirmed',
        confirmations: 24,
        type: 'send',
        timestamp: new Date(Date.now() - 7200000),
      },
      {
        walletId: btcWallet.id,
        txHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
        blockchain: 'bitcoin',
        blockNumber: BigInt(800000),
        fromAddress: 'bc1qxyz...',
        toAddress: btcWallet.address,
        amount: '10000000', // 0.1 BTC
        tokenSymbol: 'BTC',
        gasFee: '2500',
        status: 'confirmed',
        confirmations: 6,
        type: 'receive',
        timestamp: new Date(Date.now() - 86400000),
      },
    ],
  });

  console.log(`✅ Created ${transactions.count} transactions\n`);

  // Create notifications
  console.log('🔔 Creating notifications...');
  
  await prisma.notification.createMany({
    data: [
      {
        userId: user1.id,
        type: 'transaction',
        title: 'Payment Received',
        body: 'You received 1 CELO from 0x1234...5678',
        channels: ['push', 'in-app'],
        status: 'delivered',
        priority: 'normal',
        actionUrl: `/wallet/${celoWallet.id}`,
        actionLabel: 'View Wallet',
        sentAt: new Date(Date.now() - 3600000),
        deliveredAt: new Date(Date.now() - 3590000),
      },
      {
        userId: user1.id,
        type: 'security',
        title: 'New Login Detected',
        body: 'Your account was accessed from a new device',
        channels: ['email', 'push', 'in-app'],
        status: 'read',
        priority: 'high',
        actionUrl: '/settings/security',
        actionLabel: 'Review Activity',
        sentAt: new Date(Date.now() - 86400000),
        deliveredAt: new Date(Date.now() - 86390000),
        readAt: new Date(Date.now() - 82800000),
      },
      {
        userId: user2.id,
        type: 'system',
        title: 'Wallet Synced',
        body: 'Your Bitcoin wallet has been successfully synced',
        channels: ['in-app'],
        status: 'delivered',
        priority: 'low',
        sentAt: new Date(Date.now() - 86400000),
        deliveredAt: new Date(Date.now() - 86395000),
      },
    ],
  });

  console.log('✅ Created notifications\n');

  // Create virtual cards
  console.log('💳 Creating virtual cards...');
  
  const { encrypt } = await import('../src/lib/security/encryption');
  const cardNumber1 = '4532123456789012';
  const cardNumber2 = '5555123456789010';
  
  const card1 = await prisma.card.create({
    data: {
      userId: user1.id,
      walletId: celoWallet.id,
      encryptedNumber: encrypt(cardNumber1),
      cardholderName: 'ALICE JOHNSON',
      expiryMonth: 12,
      expiryYear: 2027,
      nickname: 'Daily Spending',
      brand: 'VISA',
      type: 'virtual',
      spendingLimit: 1000.00,
      dailyLimit: 200.00,
      monthlyLimit: 500.00,
      status: 'active',
      isOnline: true,
      isContactless: true,
      provider: 'mock',
      activatedAt: new Date(Date.now() - 7 * 86400000), // 7 days ago
    },
  });

  const card2 = await prisma.card.create({
    data: {
      userId: user2.id,
      walletId: btcWallet.id,
      encryptedNumber: encrypt(cardNumber2),
      cardholderName: 'BOB SMITH',
      expiryMonth: 6,
      expiryYear: 2026,
      nickname: 'Travel Card',
      brand: 'MASTERCARD',
      type: 'virtual',
      spendingLimit: 5000.00,
      dailyLimit: 500.00,
      monthlyLimit: 2000.00,
      status: 'active',
      isOnline: true,
      isContactless: true,
      provider: 'mock',
      activatedAt: new Date(Date.now() - 30 * 86400000), // 30 days ago
    },
  });

  console.log(`✅ Created ${2} cards\n`);

  // Create payment requests
  console.log('💸 Creating payment requests...');
  
  await prisma.paymentRequest.createMany({
    data: [
      {
        senderId: user1.id,
        receiverId: user2.id,
        amount: '1000000000000000000', // 1 CELO
        blockchain: 'celo',
        tokenSymbol: 'CELO',
        memo: 'Lunch money',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400000), // 7 days
      },
      {
        senderId: user2.id,
        receiverId: user1.id,
        amount: '500000000000000000', // 0.5 ETH
        blockchain: 'ethereum',
        tokenSymbol: 'ETH',
        memo: 'Thanks for the help!',
        status: 'fulfilled',
        fulfilledAt: new Date(Date.now() - 2 * 86400000),
        expiresAt: new Date(Date.now() + 5 * 86400000),
      },
    ],
  });

  console.log('✅ Created payment requests\n');

  // Create staking positions
  console.log('📈 Creating staking positions...');
  
  await prisma.stakingPosition.createMany({
    data: [
      {
        userId: user1.id,
        walletId: celoWallet.id,
        blockchain: 'celo',
        amount: '2000000000000000000', // 2 CELO staked
        apr: 5.5,
        rewards: '110000000000000000', // 0.11 CELO rewards
        status: 'active',
        protocol: 'native',
        stakedAt: new Date(Date.now() - 30 * 86400000),
      },
      {
        userId: user2.id,
        walletId: solWallet.id,
        blockchain: 'solana',
        amount: '50000000000', // 50 SOL staked
        apr: 7.2,
        rewards: '3000000000', // 3 SOL rewards
        status: 'active',
        protocol: 'native',
        stakedAt: new Date(Date.now() - 60 * 86400000),
      },
    ],
  });

  console.log('✅ Created staking positions\n');

  // Create user contacts
  console.log('📇 Creating user contacts...');
  
  await prisma.userContact.createMany({
    data: [
      {
        userId: user1.id,
        contactType: 'username',
        contactValue: 'bob',
        displayName: 'Bob Smith',
        resolvedAddress: btcWallet.address,
        resolvedBlockchain: 'bitcoin',
      },
      {
        userId: user2.id,
        contactType: 'phone',
        contactValue: '+4798765432',
        displayName: 'Alice Johnson',
        resolvedAddress: celoWallet.address,
        resolvedBlockchain: 'celo',
      },
    ],
  });

  console.log('✅ Created user contacts\n');

  console.log('✨ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Users: 2`);
  console.log(`   Wallets: 4`);
  console.log(`   Transactions: ${transactions.count}`);
  console.log(`   Notifications: 3`);
  console.log(`   Cards: 2`);
  console.log(`   Payment Requests: 2`);
  console.log(`   Staking Positions: 2`);
  console.log(`   Contacts: 2`);
  console.log('\n🎉 Database is ready for development!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
