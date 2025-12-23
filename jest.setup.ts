// Jest Setup File
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'celora-7b552';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'celora-7b552.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'celora-7b552.firebasestorage.app';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '505448793868';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:505448793868:web:df0e3f80e669ab47a26b29';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createCustomToken: jest.fn(),
  })),
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  })),
}));

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
