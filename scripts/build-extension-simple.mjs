import { mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const distDir = path.join(extensionDir, 'dist');

/**
 * Build extension - popup.html contains inline React app (no bundling needed)
 */
async function run() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(path.join(distDir, 'background'), { recursive: true });

  console.log('🔨 Building extension (CSP-safe external scripts)...');

  // Copy manifest.json and popup.html
  try {
    await cp(path.join(extensionDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
    await cp(path.join(extensionDir, 'popup.html'), path.join(distDir, 'popup.html'));
    await cp(path.join(extensionDir, 'popup.css'), path.join(distDir, 'popup.css'));
    console.log('✅ Copied manifest.json, popup.html, popup.css');
  } catch (e) {
    console.error('❌ Failed to copy core files:', e.message);
  }

  // Create minimal popup.js stub
  const popupStub = `// Extension popup - React app loads inline from popup.html
console.log('[Celora Extension] Popup loaded - v1.0.0');`;

  await writeFile(path.join(distDir, 'popup.js'), popupStub, 'utf-8');
  console.log('✅ popup.js stub created');

  // Copy or create background service worker
  try {
    const bgSource = path.join(extensionDir, 'background', 'service-worker.js');
    const bgContent = await readFile(bgSource, 'utf-8');
    await writeFile(path.join(distDir, 'background', 'service-worker.js'), bgContent, 'utf-8');
    console.log('✅ Background worker copied');
  } catch (e) {
    // Create minimal service worker if source doesn't exist
    const bgStub = `// Celora Extension Background Service Worker
console.log('[Celora Extension] Background service worker initialized');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Celora Extension] Installed:', details.reason);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Celora Extension] Message received:', message);
  sendResponse({ success: true });
  return true;
});`;
    await writeFile(path.join(distDir, 'background', 'service-worker.js'), bgStub, 'utf-8');
    console.log('✅ Background worker stub created');
  }

  // Copy vendor bundles
  await mkdir(path.join(distDir, 'vendor'), { recursive: true });
  try {
    await cp(path.join(extensionDir, 'vendor'), path.join(distDir, 'vendor'), { recursive: true });
    console.log('✅ Copied vendor/ directory');
  } catch (e) {
    console.warn('⚠️ Failed to copy vendor/:', e.message);
  }

  // Copy wallet modules
  await mkdir(path.join(distDir, 'wallet'), { recursive: true });
  try {
    await cp(path.join(extensionDir, 'wallet'), path.join(distDir, 'wallet'), { recursive: true });
    console.log('✅ Copied wallet/ directory');
  } catch (e) {
    console.warn('⚠️ Failed to copy wallet/:', e.message);
  }

  // Copy app scripts
  try {
    const configContent = await readFile(path.join(extensionDir, 'config.js'), 'utf-8');
    await writeFile(path.join(distDir, 'config.js'), configContent, 'utf-8');
    
    const authContent = await readFile(path.join(extensionDir, 'auth.js'), 'utf-8');
    await writeFile(path.join(distDir, 'auth.js'), authContent, 'utf-8');
    
    const apiContent = await readFile(path.join(extensionDir, 'api.js'), 'utf-8');
    await writeFile(path.join(distDir, 'api.js'), apiContent, 'utf-8');
    
    const appContent = await readFile(path.join(extensionDir, 'popup-app.js'), 'utf-8');
    await writeFile(path.join(distDir, 'popup-app.js'), appContent, 'utf-8');
    
    console.log('✅ Copied config.js, auth.js, api.js, and popup-app.js');
  } catch (e) {
    console.warn('⚠️ Failed to copy app scripts:', e.message);
  }

  console.log('\n✅ Extension build complete!');
  console.log('   Load in Chrome: chrome://extensions → Developer mode → Load unpacked → extension folder');
}

run().catch((error) => {
  console.error('❌ Failed to build extension:', error);
  process.exitCode = 1;
});
