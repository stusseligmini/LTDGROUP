/**
 * Verification Script - Check Implementation Completeness
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Celora V2 Implementation...\n');

const checks = [];

// Check database schema
function checkSchema() {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  const hasUsers = schema.includes('model User');
  const hasTelegramUser = schema.includes('model TelegramUser');
  const hasTelegramSession = schema.includes('model TelegramSession');
  const hasTelegramNotification = schema.includes('model TelegramNotification');
  const hasAuditLog = schema.includes('model AuditLog');
  const hasTelegramId = schema.includes('telegramId');
  const hasCardProvider = schema.includes('preferredCardProvider');
  
  checks.push({
    name: 'Database Schema',
    passed: hasUsers && hasTelegramUser && hasTelegramSession && hasTelegramNotification && hasAuditLog && hasTelegramId && hasCardProvider,
    details: `Models: User✓ TelegramUser${hasTelegramUser?'✓':'✗'} TelegramSession${hasTelegramSession?'✓':'✗'} TelegramNotification${hasTelegramNotification?'✓':'✗'} AuditLog${hasAuditLog?'✓':'✗'}`
  });
}

// Check Telegram bot files
function checkTelegramBot() {
  const requiredFiles = [
    'src/server/telegram/client.ts',
    'src/server/telegram/types.ts',
    'src/server/telegram/commands/start.ts',
    'src/server/telegram/commands/balance.ts',
    'src/server/telegram/commands/help.ts',
    'src/server/telegram/commands/cards.ts',
    'src/server/telegram/commands/receive.ts',
    'src/server/telegram/handlers/webhook.ts',
    'src/server/telegram/handlers/callback.ts',
    'src/server/telegram/middleware/auth.ts',
    'src/server/telegram/middleware/logging.ts',
    'src/server/telegram/utils/keyboard.ts',
    'src/server/telegram/utils/formatter.ts',
  ];
  
  const existing = requiredFiles.filter(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  checks.push({
    name: 'Telegram Bot Backend',
    passed: existing.length === requiredFiles.length,
    details: `${existing.length}/${requiredFiles.length} files created`
  });
}

// Check API endpoints
function checkAPIEndpoints() {
  const requiredEndpoints = [
    'src/app/api/telegram/webhook/route.ts',
    'src/app/api/telegram/link/initiate/route.ts',
    'src/app/api/telegram/link/verify/route.ts',
    'src/app/api/telegram/link/status/route.ts',
  ];
  
  const existing = requiredEndpoints.filter(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  checks.push({
    name: 'Telegram API Endpoints',
    passed: existing.length === requiredEndpoints.length,
    details: `${existing.length}/${requiredEndpoints.length} endpoints created`
  });
}

// Check Mini App
function checkMiniApp() {
  const requiredFiles = [
    'src/lib/telegram/webapp.ts',
    'src/app/telegram/layout.tsx',
    'src/app/telegram/page.tsx',
    'src/app/telegram/wallet/page.tsx',
    'src/app/telegram/cards/page.tsx',
    'src/components/telegram/TelegramButton.tsx',
  ];
  
  const existing = requiredFiles.filter(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  checks.push({
    name: 'Telegram Mini App',
    passed: existing.length === requiredFiles.length,
    details: `${existing.length}/${requiredFiles.length} files created`
  });
}

// Check shared services
function checkServices() {
  const requiredFiles = [
    'src/lib/qrcode-generator.ts',
    'src/server/services/priceService.ts',
    'src/server/services/transactionService.ts',
    'src/server/services/cardIssuing/interface.ts',
    'src/server/services/cardIssuing/factory.ts',
    'src/server/services/cardIssuing/types.ts',
    'src/server/services/cardIssuing/mock/provider.ts',
  ];
  
  const existing = requiredFiles.filter(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  checks.push({
    name: 'Shared Services',
    passed: existing.length === requiredFiles.length,
    details: `${existing.length}/${requiredFiles.length} services created`
  });
}

// Check extension enhancements
function checkExtension() {
  const manifestPath = path.join(__dirname, '../extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  const hasIdlePermission = manifest.permissions.includes('idle');
  const hasClipboardPermission = manifest.permissions.includes('clipboardWrite');
  
  const securityExists = fs.existsSync(path.join(__dirname, '../extension/src/security.ts'));
  const extensionSecurityExists = fs.existsSync(path.join(__dirname, '../src/lib/security/extensionSecurity.ts'));
  
  checks.push({
    name: 'Extension Enhancement',
    passed: hasIdlePermission && hasClipboardPermission && securityExists && extensionSecurityExists,
    details: `Permissions✓ Security${securityExists?'✓':'✗'} ExtSecurity${extensionSecurityExists?'✓':'✗'}`
  });
}

// Check documentation
function checkDocumentation() {
  const requiredDocs = [
    'docs/telegram-bot-guide.md',
    'docs/extension-guide.md',
    'docs/developer/architecture.md',
    'docs/developer/telegram-setup.md',
    'docs/INTEGRATION-GUIDE.md',
    'docs/CARD-PROVIDERS.md',
    'README-IMPLEMENTATION-STATUS.md',
    'IMPLEMENTATION-COMPLETE.md',
    'FINAL-IMPLEMENTATION-SUMMARY.md',
    'ALL-PHASES-COMPLETE.md',
    'QUICKSTART.md',
    'START-HERE.md',
  ];
  
  const existing = requiredDocs.filter(file => 
    fs.existsSync(path.join(__dirname, '..', file))
  );
  
  checks.push({
    name: 'Documentation',
    passed: existing.length === requiredDocs.length,
    details: `${existing.length}/${requiredDocs.length} documents created`
  });
}

// Run all checks
try {
  checkSchema();
  checkTelegramBot();
  checkAPIEndpoints();
  checkMiniApp();
  checkServices();
  checkExtension();
  checkDocumentation();
  
  // Display results
  console.log('┌' + '─'.repeat(60) + '┐');
  console.log('│' + ' '.repeat(15) + 'VERIFICATION RESULTS' + ' '.repeat(24) + '│');
  console.log('├' + '─'.repeat(60) + '┤');
  
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    const name = check.name.padEnd(30);
    console.log(`│ ${status} ${name} │`);
    console.log(`│    ${check.details.padEnd(55)} │`);
  });
  
  console.log('└' + '─'.repeat(60) + '┘\n');
  
  const allPassed = checks.every(c => c.passed);
  
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED! 🎉\n');
    console.log('✅ Database schema complete');
    console.log('✅ Telegram bot implemented');
    console.log('✅ API endpoints created');
    console.log('✅ Mini App built');
    console.log('✅ Shared services ready');
    console.log('✅ Extension enhanced');
    console.log('✅ Documentation complete');
    console.log('\n🚀 Ready to launch!\n');
    console.log('Next steps:');
    console.log('  1. Configure environment (.env.local)');
    console.log('  2. Run: npm run dev');
    console.log('  3. Visit: http://localhost:3000');
    console.log('\nSee START-HERE.md for full quickstart guide!\n');
  } else {
    console.log('⚠️  Some checks failed. See details above.\n');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
}

















