/**
 * Test Firestore Connection
 * Quick script to verify Firestore is working
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local manually
const envPath = join(__dirname, '..', '.env.local');
let envContent;
try {
  envContent = readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('Failed to read .env.local:', error.message);
  process.exit(1);
}

// Parse env vars
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

const projectId = envVars.FIREBASE_PROJECT_ID || 'celora-7b552';
const clientEmail = envVars.FIREBASE_CLIENT_EMAIL;
const privateKey = envVars.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env.local');
  console.error('Required: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

try {
  console.log('[TEST] Initializing Firebase Admin...');
  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  console.log('[TEST] Getting Firestore instance...');
  const db = getFirestore(app);

  console.log('[TEST] Testing Firestore connection...');
  
  // Test 1: Get collections
  const collections = await db.listCollections();
  console.log(`✅ Found ${collections.length} collections:`, collections.map(c => c.id));

  // Test 2: Count users
  const usersSnapshot = await db.collection('users').limit(5).get();
  console.log(`✅ Users collection: ${usersSnapshot.size} documents (showing first 5)`);

  // Test 3: Test nested collections
  if (!usersSnapshot.empty) {
    const firstUser = usersSnapshot.docs[0];
    console.log(`✅ First user ID: ${firstUser.id}`);
    
    const walletsSnapshot = await db
      .collection('users')
      .doc(firstUser.id)
      .collection('wallets')
      .limit(3)
      .get();
    
    console.log(`✅ Wallets for user ${firstUser.id}: ${walletsSnapshot.size} documents`);
    
    const txSnapshot = await db
      .collection('users')
      .doc(firstUser.id)
      .collection('transactions')
      .limit(3)
      .get();
    
    console.log(`✅ Transactions for user ${firstUser.id}: ${txSnapshot.size} documents`);
  }

  console.log('\n✅ FIRESTORE CONNECTION TEST PASSED!');
  console.log('Database is working correctly.');

} catch (error) {
  console.error('❌ FIRESTORE CONNECTION TEST FAILED!');
  console.error(error);
  process.exit(1);
}
