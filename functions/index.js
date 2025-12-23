const functions = require('firebase-functions/v1');
const next = require('next');

// Load .env if present
require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production';
const app = next({ dev: isDev, conf: { distDir: '.next' } });
const handle = app.getRequestHandler();

// Prepare app once at cold start
let appPrepared = false;

exports.nextServer = functions.https.onRequest(async (req, res) => {
  try {
    const startTs = Date.now();
    const method = req.method;
    const ua = req.get('user-agent') || 'unknown';
    const trace = req.get('x-cloud-trace-context') || 'no-trace';
    const referrer = req.get('referrer') || req.get('referer') || 'direct';
    const url = req.originalUrl || req.url;
    console.log(`[nextServer] start method=${method} url=${url} referrer=${referrer} ua=${ua.substring(0, 50)} trace=${trace}`);
    if (!appPrepared) {
      console.log('[nextServer] Preparing Next app (cold start)');
      await app.prepare();
      appPrepared = true;
    }
    return handle(req, res).finally(() => {
      const dur = Date.now() - startTs;
      const status = res.statusCode || 'unknown';
      console.log(`[nextServer] end method=${method} url=${url} status=${status} dur=${dur}ms trace=${trace}`);
    });
  } catch (err) {
    console.error('[nextServer] SSR error:', err);
    res.status(500).send('Internal Server Error');
  }
});
// ============================================================================
// CRON JOBS - Scheduled Functions
// ============================================================================

const cron = require('./cron');

exports.balanceSyncCron = cron.balanceSyncCron;
exports.transactionMonitorCron = cron.transactionMonitorCron;
exports.scheduledPaymentsCron = cron.scheduledPaymentsCron;

