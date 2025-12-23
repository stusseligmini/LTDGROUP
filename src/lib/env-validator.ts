/**
 * Environment variable validation
 * Ensures all required variables are present at startup
 */

export function validateEnvironment() {
  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'TELEGRAM_BOT_TOKEN',
    'DATABASE_URL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      console.warn(`⚠️ ${message}`);
    }
  }

  console.log('✅ Environment variables validated');
}
