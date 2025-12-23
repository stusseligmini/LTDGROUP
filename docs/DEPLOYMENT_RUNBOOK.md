#!/bin/bash

# Celora Deployment Runbook
# Complete guide for deployment, monitoring, and secret rotation

## Table of Contents
1. [Deployment](#deployment)
2. [Monitoring](#monitoring)
3. [Secret Rotation](#secret-rotation)
4. [Incident Response](#incident-response)
5. [Rollback](#rollback)

---

## Deployment

### Prerequisites
- Node.js >= 20.0.0
- Firebase CLI: `npm install -g firebase-tools`
- Authenticated with Firebase: `firebase login`

### Build & Deploy

```bash
# Navigate to project
cd "C:\Users\volde\Desktop\Celora rebuild\CeloraV2"

# Install dependencies (if needed)
npm install

# Build the project (includes Prisma generation)
npm run build

# Deploy hosting and functions
firebase deploy --only "hosting,functions"

# Watch logs during and after deployment
firebase functions:log --only nextServer --project=celora-7b552
```

### Deployment Checklist
- [ ] All tests pass: `npm test`
- [ ] No build errors
- [ ] Secrets configured in Firebase Secret Manager
- [ ] Environment variables set in apphosting.yaml
- [ ] RPC endpoint responding (check logs)
- [ ] Wallet summary endpoint returns 200
- [ ] Telegram auth validates signatures
- [ ] CSRF validation active (GET sets cookie, POST validates)

---

## Monitoring

### Sentry Integration (Error Tracking)

1. **Create Sentry Project:**
   - Go to sentry.io and create a Next.js project
   - Get DSN key

2. **Set Environment Variable:**
   ```bash
   firebase functions:secrets:set NEXT_PUBLIC_SENTRY_DSN --project=celora-7b552
   # Paste: https://<key>@<org>.ingest.sentry.io/<project>
   ```

3. **Deploy Functions:**
   ```bash
   firebase deploy --only functions
   ```

4. **Monitor Errors:**
   - Sentry dashboard: https://sentry.io/organizations/<your-org>/issues/
   - Real-time alerts on new errors
   - Performance monitoring enabled for production

### Firebase Cloud Logging

```bash
# View live logs
firebase functions:log --follow --project=celora-7b552

# Check specific function
firebase functions:log --only nextServer --project=celora-7b552

# Search for errors
firebase functions:log --project=celora-7b552 | grep -i error

# Check CSRF validation failures
firebase functions:log --project=celora-7b552 | grep "CSRF"
```

### Health Check Endpoints

```bash
# API health
curl https://celora-7b552.web.app/api/diagnostics/health

# Wallet summary (requires user ID)
curl -H "x-user-id: test_user" \
     https://celora-7b552.web.app/api/wallet/summary

# Telegram auth test
curl -X POST https://celora-7b552.web.app/api/telegram/auth \
     -H "Content-Type: application/json" \
     -d '{"telegramId": 123456, "initData": "invalid"}'
```

---

## Secret Rotation

### Telegram Bot Token Rotation

```bash
# 1. Create new bot in Telegram BotFather
# 2. Save new token

# 3. Update Secret Manager
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project=celora-7b552 --force
# Paste new token when prompted

# 4. Redeploy functions
firebase deploy --only functions

# 5. Update webhook URL in Telegram BotFather with new token
curl -X POST "https://api.telegram.org/bot<NEW_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://celora-7b552.web.app/api/telegram/webhook"}'

# 6. Verify webhook
curl "https://api.telegram.org/bot<NEW_TOKEN>/getWebhookInfo"
```

### reCAPTCHA Secret Key Rotation

```bash
# 1. Generate new key pair at https://www.google.com/recaptcha/admin
# 2. Save public and secret keys

# 3. Update secret in Firebase
firebase functions:secrets:set RECAPTCHA_SECRET_KEY --project=celora-7b552 --force

# 4. Update public key in apphosting.yaml
# NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY=<new_public_key>

# 5. Rebuild and deploy
npm run build
firebase deploy --only "hosting,functions"
```

### GCP Private Key Rotation

```bash
# 1. Create new service account key in Google Cloud Console
# 2. Download JSON key file

# 3. Extract and set secret
firebase functions:secrets:set GCP_PRIVATE_KEY --project=celora-7b552 --force

# 4. Delete old key from Google Cloud Console
# (Prevents unauthorized access via leaked keys)

# 5. Redeploy functions
firebase deploy --only functions
```

---

## Incident Response

### Wallet Summary Endpoint Failing (500)

**Diagnosis:**
```bash
firebase functions:log --only nextServer --project=celora-7b552
# Look for: "Wallet summary error" or database/RPC errors
```

**Solutions:**
1. Check RPC endpoint: `curl https://mainnet.helius-rpc.com/?api-key=<key>`
2. Check database: Ensure Neon connection string is correct
3. Restart function: `firebase deploy --only functions`

### Telegram Auth Returning 401

**Cause:** Telegram `initData` signature validation failed

**Check:**
- Telegram bot token is correct
- `initData` from Telegram Mini App is complete
- Token not expired (Telegram invalidates after ~300s)

**Fix:**
```bash
# Verify token
firebase functions:secrets:get TELEGRAM_BOT_TOKEN --project=celora-7b552
# Match with BotFather
```

### CSRF Validation Failing on API Calls

**Cause:** Missing or mismatched CSRF token

**Browser Requests:**
1. GET to receive CSRF cookie: `Set-Cookie: celora-csrf-token=<token>`
2. POST must include token: `X-CSRF-Token: <token>` header

**Server Requests (Telegram Webhook):**
- CSRF bypassed for `/api/telegram/*` endpoints
- Use HMAC signature validation instead

**Fix:**
- Browser clients: Ensure cookies enabled
- Server clients: Use direct signature validation (not CSRF)

---

## Rollback

### Quick Rollback (Previous Version)

```bash
# View deployment history
firebase deploy:list

# Rollback to previous hosting version
firebase hosting:channel:deploy <channel> --expires 7d

# Rollback functions: redeploy previous code
git checkout HEAD~1
npm run build
firebase deploy --only functions
```

### Emergency Disable

```bash
# Disable Telegram bot
firebase functions:secrets:set TELEGRAM_BOT_ENABLED --project=celora-7b552
# Type: false

firebase deploy --only functions

# Or disable endpoint in code
# Change: TELEGRAM_BOT_ENABLED check in route.ts
```

---

## Troubleshooting

| Issue | Logs | Fix |
|-------|------|-----|
| JsonRpcProvider failed | `JsonRpcProvider failed to detect network` | Check RPC endpoint, retry with fallback |
| Prisma connection error | `PrismaClientKnownRequestError` | Verify DATABASE_URL and DIRECT_DATABASE_URL |
| Firebase auth fail | `Failed to generate token` | Check GCP_PRIVATE_KEY secret |
| Telegram signature invalid | `Signature invalid, rejecting` | Verify TELEGRAM_BOT_TOKEN is current |
| CSRF validation failed | `[CSRF] Validation failed` | Check bypass paths, cookie domain |

---

## Contacts & Resources

- **Firebase Console:** https://console.firebase.google.com/project/celora-7b552
- **Sentry Dashboard:** https://sentry.io/organizations/<your-org>/issues/
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Next.js Docs:** https://nextjs.org/docs
- **Firebase Functions Docs:** https://firebase.google.com/docs/functions
