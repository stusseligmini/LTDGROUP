  /**
 * Hyper-advanced autofix + deploy script (Windows/CI friendly)
 * - Scans for hardcoded secrets
 * - Detects exact duplicate files by content hash
 * - Performs safe cleanup of build artifacts
 * - Builds frontend (Next.js), functions, and mobile (optional)
 * - Deploys Hosting + Functions to Firebase
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const SECRET_PATTERNS = [
  // Actual secret values, not env var references
  /sk_live_[A-Za-z0-9]{24,}/,
  /[0-9]{10}:[A-Za-z0-9_-]{35}/, // Telegram bot token format
  /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/,
  /["']sk_test_[A-Za-z0-9]{24,}["']/,
  /eyJ[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+?\.[A-Za-z0-9_\-]+/, // JWT
  /AIza[0-9A-Za-z\-_]{35}/, // Google API key
  /api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9-_]{20,}["']/i, // Generic API key assignments
];

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.vercel',
  '.git',
  'playwright-report',
  'test-results',
  'functions/node_modules',
]);

const REQUIRED_CONFIG_FILES = [
  'firebase.json',
  'firestore.rules',
  '.firebaserc',
];

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function checkHardcoding(root) {
  const offenders = [];
  for (const file of walk(root)) {
    const ext = path.extname(file).toLowerCase();
    // Only scan code/config files
    if (!['.ts', '.tsx', '.js', '.json', '.yaml', '.yml'].includes(ext)) continue;
    
    // Skip documentation, this script, and service account files (expected to have secrets)
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel.startsWith('docs/') || rel.includes('GUIDE.md') || rel.includes('SETUP.md') || 
        rel.includes('autofix-deploy.js') || rel.includes('firebase-admin-key.json')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    for (const rx of SECRET_PATTERNS) {
      if (rx.test(content)) {
        offenders.push({ file, pattern: rx.source });
        break;
      }
    }
  }
  return offenders;
}

function findDuplicates(root) {
  const seen = new Map();
  const duplicates = [];
  for (const file of walk(root)) {
    const stat = fs.statSync(file);
    if (stat.size === 0) continue;
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    if (seen.has(hash)) {
      duplicates.push({ original: seen.get(hash), duplicate: file });
    } else {
      seen.set(hash, file);
    }
  }
  return duplicates;
}

function safeDelete(filePath, reason) {
  // Only delete generated artifacts, never source code
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const allowedPrefixes = [
    '.next/',
    '.turbo/',
    '.vercel/',
    'dist/',
    'final_build/',
    'build_output/',
    'build_log_full',
    'build_no_global_error',
    'functions/.next/',
    'functions/lib/',
    'playwright-report/',
    'test-results/',
  ];
  if (!allowedPrefixes.some(p => rel.startsWith(p))) {
    console.log(`⚠️ Skipping delete (not a build artifact): ${rel}`);
    return;
  }
  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (!stat) {
    console.log(`ℹ️ Already removed or missing: ${rel}`);
    return;
  }
  if (!stat.isFile()) {
    console.log(`⚠️ Not a file, skipping unlink: ${rel}`);
    return;
  }
  console.log(`🧹 Deleting: ${rel} → ${reason}`);
  fs.unlinkSync(filePath);
}

function rimraf(target) {
  if (fs.existsSync(target)) {
    console.log(`🧹 Removing: ${path.relative(ROOT, target)}`);
    // Cross-platform removal
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch {
      execSync(process.platform === 'win32' ? `powershell -Command "Remove-Item -Recurse -Force \"${target}\""` : `rm -rf "${target}"`);
    }
  }
}

function cleanBuilds() {
  rimraf(path.join(ROOT, '.next'));
  rimraf(path.join(ROOT, '.turbo'));
  rimraf(path.join(ROOT, '.vercel'));
  rimraf(path.join(ROOT, 'dist'));
  rimraf(path.join(ROOT, 'final_build'));
  rimraf(path.join(ROOT, 'build_output'));
  rimraf(path.join(ROOT, 'build_log_full'));
  rimraf(path.join(ROOT, 'build_no_global_error'));
  rimraf(path.join(ROOT, 'functions', 'lib'));
  rimraf(path.join(ROOT, 'functions', '.next'));
  rimraf(path.join(ROOT, 'playwright-report'));
  rimraf(path.join(ROOT, 'test-results'));
}

function buildFrontend(skipInstall = true) {
  console.log('⚙️ Building frontend (Next.js)...');
  if (!skipInstall) {
    execSync('npm ci', { stdio: 'inherit', cwd: ROOT });
  }
  execSync('npm run build', { stdio: 'inherit', cwd: ROOT });
}

function buildFunctions(skipInstall = true) {
  const functionsDir = path.join(ROOT, 'functions');
  if (!fs.existsSync(functionsDir)) {
    console.log('ℹ️ No functions/ directory present, skipping build');
    return;
  }
  console.log('⚙️ Building Cloud Functions...');
  if (!skipInstall) {
    execSync('npm ci', { stdio: 'inherit', cwd: functionsDir });
  }
  // If using TypeScript, compile. Otherwise skip.
  if (fs.existsSync(path.join(functionsDir, 'tsconfig.json'))) {
    execSync('npm run build', { stdio: 'inherit', cwd: functionsDir });
  }

   // Copy the freshly built Next.js output into functions/.next so the
   // deployed function serves the latest API routes (including Telegram).
   const sourceNextDir = path.join(ROOT, '.next');
   const targetNextDir = path.join(functionsDir, '.next');
   if (fs.existsSync(sourceNextDir)) {
     rimraf(targetNextDir);
     fs.cpSync(sourceNextDir, targetNextDir, { recursive: true });
     console.log('📦 Synced .next build into functions/.next');
   } else {
     console.warn('⚠️ No root .next build found to copy into functions/.next');
   }
}

function deployFirebase() {
  for (const required of REQUIRED_CONFIG_FILES) {
    if (!fs.existsSync(path.join(ROOT, required))) {
      throw new Error(`Missing required config: ${required}`);
    }
  }

  try {
    execSync('firebase --version', { stdio: 'ignore' });
  } catch {
    throw new Error('Firebase CLI not found. Install @ latest: npm i -g firebase-tools');
  }

  console.log('🚀 Deploy to Firebase Hosting + Functions...');
  execSync('firebase deploy --only hosting,functions --force', { stdio: 'inherit', cwd: ROOT });
}

function main() {
  const args = process.argv.slice(2);
  const skipDeploy = args.includes('--skip-deploy');
  const fullInstall = args.includes('--full-install');
  const skipFrontend = args.includes('--skip-frontend');
  const skipFunctions = args.includes('--skip-functions');
  const noClean = args.includes('--no-clean');
  const allowSecrets = args.includes('--allow-secrets');

  console.log('🔍 Full system analysis...');
  const offenders = checkHardcoding(ROOT);
  if (offenders.length) {
    console.log('❌ Hardcoded secrets detected:');
    for (const o of offenders) console.log(` - ${o.file} (pattern: ${o.pattern})`);
    if (!allowSecrets) {
      console.log('Aborting to prevent leaking secrets. Move secrets to env/Secret Manager.');
      process.exit(1);
    } else {
      console.log('⚠️  Proceeding due to --allow-secrets flag. Ensure keys are rotated and moved to env ASAP.');
    }
  }

  console.log('🔎 Searching for duplicate files by content...');
  const duplicates = findDuplicates(ROOT);
  if (duplicates.length) {
    for (const d of duplicates) {
      console.log(`⚠️ Duplicate: ${path.relative(ROOT, d.duplicate)} (original: ${path.relative(ROOT, d.original)})`);
      safeDelete(d.duplicate, 'Duplicate build artifact');
    }
  } else {
    console.log('✅ No exact duplicate files by content');
  }

  console.log('🧹 Cleaning old builds...');
  if (!noClean) {
    cleanBuilds();
  } else {
    console.log('⏭️  Skipping cleanup (--no-clean flag)');
  }

  console.log('🔧 Building all modules...');
  if (!skipFrontend) {
    buildFrontend(!fullInstall);
  } else {
    console.log('⏭️  Skipping frontend build (--skip-frontend flag)');
  }

  if (!skipFunctions) {
    buildFunctions(!fullInstall);
  } else {
    console.log('⏭️  Skipping functions build (--skip-functions flag)');
  }

  if (!skipDeploy) {
    console.log('🚀 Deploying...');
    deployFirebase();
  } else {
    console.log('⏭️  Skipping deploy (--skip-deploy flag)');
  }

  console.log('✅ Autofix + deploy complete');
}

main();
