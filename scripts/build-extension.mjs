import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const extensionDir = path.join(rootDir, 'extension');
const distDir = path.join(extensionDir, 'dist');

/**
 * Build extension with esbuild - bundles popup.tsx with all dependencies
 */
async function run() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(path.join(distDir, 'background'), { recursive: true });

  console.log('🔨 Building popup.tsx with esbuild...');

  try {
    // Bundle popup.tsx with esbuild
    await esbuild.build({
      entryPoints: [path.join(extensionDir, 'src', 'popup.tsx')],
      bundle: true,
      outfile: path.join(distDir, 'popup.js'),
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: true,
      sourcemap: false,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      alias: {
        '@': path.join(rootDir, 'src'),
      },
      external: ['chrome'],
      jsx: 'automatic',
      jsxImportSource: 'react',
      logLevel: 'info',
    });

    console.log('✅ Extension popup.js built from popup.tsx');

  } catch (error) {
    console.error('❌ Failed to build popup.js:', error);
    throw error;
  }

  // Copy or create background service worker
  try {
    const bgSource = path.join(extensionDir, 'background', 'service-worker.js');
    const bgContent = await readFile(bgSource, 'utf-8');
    await writeFile(path.join(distDir, 'background', 'service-worker.js'), bgContent, 'utf-8');
    console.log('✅ Extension background worker copied to extension/dist/background/service-worker.js');
  } catch (e) {
    // Create minimal service worker if source doesn't exist
    const bgStub = `
// Celora Extension Background Service Worker
console.log('[Celora Extension] Background service worker initialized');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Celora Extension] Installed:', details.reason);
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Celora Extension] Message received:', message);
  sendResponse({ success: true });
  return true;
});
`;
    await writeFile(path.join(distDir, 'background', 'service-worker.js'), bgStub, 'utf-8');
    console.log('✅ Extension background worker stub created');
  }
}

run().catch((error) => {
  console.error('❌ Failed to build extension bundle');
  console.error(error);
  process.exitCode = 1;
});

