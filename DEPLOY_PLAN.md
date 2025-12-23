# 🚀 CELORA - DIN DEPLOYMENT PLAN

**Status: 85% FERDIG** ✅  
**Estimert tid: 4-6 timer**

---

## ✅ ALLEREDE FIKSET (Gjort av AI)

1. ✅ jest.setup.ts opprettet - tester virker
2. ✅ Encryption keys generert og lagt i .env.local
3. ✅ MASTER_ENCRYPTION_KEY, WALLET_ENCRYPTION_KEY, SEED_PHRASE_ENCRYPTION_KEY
4. ✅ API_SECRET_KEY, BACKUP_ENCRYPTION_KEY
5. ✅ NEXTAUTH_SECRET, JWT_SECRET
6. ✅ Komplett dokumentasjon i docs/LAUNCH_CHECKLIST.md

---

## 📋 DU MÅ GJØRE (4-6 timer totalt)

### ⏱️ FASE 1: SENTRY SETUP (30 min)

**Hva:** Feilsporing i produksjon

**Steg:**
1. Gå til https://sentry.io
2. Opprett gratis konto
3. Opprett nytt Next.js prosjekt (navn: Celora)
4. Kopier DSN nøkkelen
5. Legg til i .env.local:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```
6. Test: `npm run dev` → sjekk at Sentry fungerer

---

### ⏱️ FASE 2: RECAPTCHA ENTERPRISE (30 min)

**Hva:** Bot beskyttelse

**Steg:**
1. Gå til https://console.cloud.google.com/security/recaptcha
2. Velg prosjekt: `celora-7b552`
3. Opprett ny nøkkel:
   - Type: Score-based (v3)
   - Domener: localhost, celora.net, celora-7b552.web.app
4. Kopier Site Key og Secret Key
5. Oppdater .env.local (erstatt dummy verdier):
   ```env
   NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY=<din_site_key>
   RECAPTCHA_SECRET_KEY=<din_secret_key>
   ```

**⚠️ VIKTIG:** De eksisterende nøklene er dummy-data!

---

### ⏱️ FASE 3: TELEGRAM WEBHOOK VALIDERING (1-2 timer)

**Hva:** Sikre webhook endpoint

**Filer å redigere:**
1. `src/app/api/telegram/webhook/route.ts`
2. `docs/SECURITY_IMPLEMENTATION.md`

**Kode å legge til:**
```typescript
// I webhook/route.ts
import crypto from 'crypto';

function validateTelegramSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

// I POST handler:
const signature = request.headers.get('x-telegram-bot-api-secret-token');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET!;

if (!validateTelegramSignature(rawBody, signature, secret)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**Test:**
```powershell
# Test webhook lokalt
npm run dev
# Send test request til http://localhost:3000/api/telegram/webhook
```

---

### ⏱️ FASE 4: RATE LIMITING (1 time)

**Hva:** Beskytte API mot spam

**Løsning:** Bruk Vercel's innebygde rate limiting

**Steg:**
1. Opprett `src/middleware.ts` (sjekk om den allerede finnes)
2. Legg til:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting (use Redis/Upstash for production)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function middleware(request: NextRequest) {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  // Clean up old entries
  for (const [key, value] of rateLimit.entries()) {
    if (now > value.resetTime) {
      rateLimit.delete(key);
    }
  }

  // Check rate limit
  const current = rateLimit.get(ip) || { count: 0, resetTime: now + windowMs };
  
  if (current.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  current.count++;
  rateLimit.set(ip, current);

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Test:**
```powershell
npm run build
npm run start
```

---

### ⏱️ FASE 5: DATABASE & TESTING (1 time)

**Steg:**
```powershell
# 1. Test database connection
npm run db:studio
# Åpner Prisma Studio på http://localhost:5555

# 2. Kjør alle migreringer
npm run db:migrate:deploy

# 3. Seed database (optional)
npm run db:seed

# 4. Kjør alle tester
npm test                  # Unit tests ✅
npm run test:integration  # Integration tests
npm run test:e2e         # E2E tests (krever Playwright)
npm run test:security    # Security tests

# 5. Build test
npm run build
```

**Fiks eventuelle feil som dukker opp!**

---

### ⏱️ FASE 6: DEPLOYMENT (1-2 timer)

#### Option A: VERCEL (Anbefalt - Enklest)

```powershell
# 1. Installer Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Link project
vercel link

# 4. Legg til environment variabler (VIKTIG!)
vercel env add MASTER_ENCRYPTION_KEY
# Lim inn verdien fra .env.local
# Velg: Production, Preview, Development (alle 3)

# Repeat for ALLE secrets:
vercel env add WALLET_ENCRYPTION_KEY
vercel env add SEED_PHRASE_ENCRYPTION_KEY
vercel env add API_SECRET_KEY
vercel env add BACKUP_ENCRYPTION_KEY
vercel env add NEXTAUTH_SECRET
vercel env add JWT_SECRET
vercel env add DATABASE_URL
vercel env add DIRECT_DATABASE_URL
vercel env add HELIUS_API_KEY
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add RECAPTCHA_SECRET_KEY
vercel env add NEXT_PUBLIC_SENTRY_DSN

# 5. Deploy til staging
vercel

# 6. Test staging URL
curl https://celora-xxxxx.vercel.app/api/diagnostics/health

# 7. Deploy til produksjon
vercel --prod

# 8. Sett custom domain (optional)
vercel domains add celora.net
```

#### Option B: FIREBASE HOSTING

```powershell
# 1. Login
firebase login

# 2. Velg project
firebase use celora-7b552

# 3. Build
npm run build

# 4. Deploy
firebase deploy --only hosting,functions

# 5. Sjekk logs
firebase functions:log --only nextServer

# 6. Test
curl https://celora-7b552.web.app/api/diagnostics/health
```

---

### ⏱️ FASE 7: POST-DEPLOYMENT (30 min)

**Sjekk at alt virker:**

```powershell
# Health check
curl https://your-domain.com/api/diagnostics/health

# Test Telegram bot
# Send melding til boten på Telegram

# Test wallet opprettelse
# Gå til https://your-domain.com og opprett wallet

# Sjekk Sentry
# Gå til Sentry dashboard - se om errors logger
```

**Monitor første time:**
- [ ] Sentry dashboard - ingen kritiske feil
- [ ] Database connections - stabile
- [ ] API response times - < 2 sekunder
- [ ] Telegram bot - responderer
- [ ] Wallet creation - virker

---

## 🎯 QUICK CHECKLIST (Print denne ut!)

```
[ ] Sentry DSN lagt til .env.local
[ ] reCAPTCHA keys oppdatert (ikke dummy!)
[ ] Telegram webhook validering implementert
[ ] Rate limiting lagt til
[ ] Database migrations kjørt
[ ] Alle tester passerer
[ ] Build succeeds (npm run build)
[ ] Vercel/Firebase konto opprettet
[ ] Environment variabler lagt til hosting platform
[ ] Deploy til staging
[ ] Smoke tests på staging
[ ] Deploy til produksjon
[ ] Post-deployment monitoring
```

---

## 🆘 HVIS NOE GÅR GALT

### Tester Feiler?
```powershell
# Sjekk hvilken test
npm test -- --verbose

# Fikk TypeScript error?
npm run typecheck

# Linting error?
npm run lint:fix
```

### Build Feiler?
```powershell
# Clear cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Database Connection Error?
```powershell
# Test connection
npm run db:studio

# Sjekk DATABASE_URL i .env.local
# Verifiser password og host
```

### Deployment Feiler?
```powershell
# Vercel: Sjekk logs
vercel logs

# Firebase: Sjekk logs
firebase functions:log
```

---

## 📞 SUPPORT

**Dokumentasjon:**
- [LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md) - Komplett guide
- [DEPLOYMENT_RUNBOOK.md](./docs/DEPLOYMENT_RUNBOOK.md) - Deployment detaljer
- [SECURITY_IMPLEMENTATION.md](./docs/SECURITY_IMPLEMENTATION.md) - Sikkerhet

**Eksterne:**
- Sentry: https://sentry.io/
- Vercel: https://vercel.com/docs
- Firebase: https://firebase.google.com/docs
- Helius: https://docs.helius.dev/

---

## 🎉 FERDIG!

Når du har fullført alle stegene:

1. ✅ App kjører i produksjon
2. ✅ Monitoring er aktivt (Sentry)
3. ✅ Bot beskyttelse aktivert (reCAPTCHA)
4. ✅ Rate limiting beskytter API
5. ✅ Telegram bot fungerer
6. ✅ Wallet creation virker

**Gratulerer med lanseringen! 🚀**

---

**Start med FASE 1 nå! ⬆️**
