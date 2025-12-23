# 🚀 Celora - Komplett Lanserings Sjekkliste

Oppdatert: 22. desember 2025

## 📊 Status Oversikt

### ✅ Ferdig (20/35)
- Firebase oppsett
- Database schema (Prisma)
- Helius RPC integrasjon
- CSRF beskyttelse
- Telegram auth
- TypeScript konfigurasjon
- Next.js 15 setup
- Mobile app struktur
- Browser extension struktur
- Jest test framework setup ✅ FIKSET

### ⚠️ Må Implementeres (10/35)
- Rate limiting på API
- Telegram webhook signatur validering
- Sentry error tracking
- Database backup strategi
- Security audit
- E2E test suite fullføring
- Health check endpoint
- Monitoring alerts
- Production secrets rotation
- CDN/DDoS beskyttelse

### ❌ Mangler Konfigurasjon (5/35)
- OAuth providers (Google, Apple)
- reCAPTCHA Enterprise
- Environment variabler for produksjon
- SSL sertifikat verifisering
- Deployment pipeline

---

## 🔥 KRITISK - Må fikses før lansering

### 1. Environment Variabler
Kopier `.env.example` til `.env.local` og fyll ut alle verdier:

```powershell
cp .env.example .env.local
```

**Påkrevde variabler:**
```env
# Firebase Admin (hent fra Firebase Console > Project Settings > Service Accounts)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Encryption Keys (generer sterke nøkler!)
MASTER_ENCRYPTION_KEY=<64 hex characters>
WALLET_ENCRYPTION_KEY=<64 hex characters>
SEED_PHRASE_ENCRYPTION_KEY=<64 hex characters>
API_SECRET_KEY=<64 hex characters>
BACKUP_ENCRYPTION_KEY=<64 hex characters>

# Database (Neon PostgreSQL - hent fra https://console.neon.tech/)
DATABASE_URL=postgresql://user:password@ep-xx.us-east-1.aws.neon.tech/celora?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:password@ep-xx.us-east-1.aws.neon.tech/celora?sslmode=require

# Helius RPC (hent fra https://www.helius.dev/)
HELIUS_API_KEY=<your_helius_api_key>

# Telegram (hent fra @BotFather)
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_BOT_USERNAME=<your_bot_username>

# reCAPTCHA Enterprise (hent fra Google Cloud Console)
NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY=<your_site_key>
RECAPTCHA_SECRET_KEY=<your_secret_key>

# NextAuth
NEXTAUTH_SECRET=<generer med: openssl rand -base64 32>
JWT_SECRET=<generer med: openssl rand -base64 32>
```

### 2. Telegram Webhook Signatur Validering
Må implementeres i `src/app/api/telegram/webhook/route.ts`

**Action Required:**
```typescript
// TODO: Add TELEGRAM_WEBHOOK_SECRET validation
// See: docs/SECURITY_IMPLEMENTATION.md line 60
```

### 3. Sentry Error Tracking
**Steg:**
1. Opprett konto på https://sentry.io
2. Opprett Next.js prosjekt
3. Få DSN nøkkel
4. Legg til i `.env.local`:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
   ```
5. Deploy på nytt

### 4. Database Migreringer
Før deploy:
```powershell
# Generer Prisma Client
npm run db:generate

# Kjør migreringer (produksjon)
npm run db:migrate:deploy

# Seed data (valgfritt)
npm run db:seed
```

### 5. Rate Limiting
Implementer i `src/middleware.ts`:

```typescript
// TODO: Add rate limiting
// Forslag: 100 requests/minute per IP
// Library: @upstash/ratelimit eller express-rate-limit
```

---

## ⚙️ INSTALLASJON

### Steg 1: Dependencies
```powershell
# Installer alle pakker
npm install

# Installer global verktøy
npm install -g firebase-tools
npm install -g vercel  # hvis du bruker Vercel

# Playwright browsers (for E2E tests)
npx playwright install

# Mobile (hvis nødvendig)
cd mobile
npm install
cd ..
```

### Steg 2: Database Setup
```powershell
# Generer Prisma Client
npx prisma generate

# Push schema til database (dev)
npx prisma db push

# Eller kjør migreringer (produksjon)
npx prisma migrate deploy

# Åpne Prisma Studio (for å se data)
npx prisma studio
```

### Steg 3: Firebase Setup
```powershell
# Logg inn
firebase login

# Velg prosjekt
firebase use celora-7b552

# Deploy (første gang)
firebase deploy
```

### Steg 4: Test Setup
```powershell
# Kjør unit tests
npm test

# Kjør E2E tests
npm run test:e2e

# Kjør security tests
npm run test:security

# Sjekk type errors
npm run typecheck

# Lint kode
npm run lint
```

---

## 🔐 SIKKERHET

### Før Lansering - Sikkerhetsjekk
- [ ] Alle secrets rotert siste 90 dager
- [ ] HTTPS aktivert på alle domener
- [ ] CORS restricted til production domener
- [ ] Rate limiting på alle API endpoints
- [ ] Security headers konfigurert
- [ ] Ingen hardkodet secrets i kode
- [ ] Dependency audit kjørt (`npm audit`)
- [ ] Security scan utført
- [ ] Firebase App Check aktivert
- [ ] ReCAPTCHA Enterprise aktivert

### Encryption Keys - Generering
```powershell
# Windows PowerShell
# Generer 64 hex characters (32 bytes)
-join ((0..31) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })

# Eller bruk OpenSSL (hvis installert)
openssl rand -hex 32
```

---

## 📊 TESTING

### Test Sjekkliste
- [x] Jest setup file opprettet ✅
- [ ] Unit tests passerer (70% coverage)
- [ ] Integration tests passerer
- [ ] E2E tests passerer
- [ ] Security tests passerer
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds
- [ ] Development server starter
- [ ] Production build virker

### Kjør alle tester
```powershell
# Full test suite
npm run check  # lint + typecheck
npm test      # unit tests
npm run test:integration
npm run test:e2e
npm run test:security
npm run build  # production build test
```

---

## 🚀 DEPLOYMENT

### Vercel (Anbefalt for Next.js)
```powershell
# Installer Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy til staging
vercel

# Deploy til production
vercel --prod
```

### Firebase Hosting
```powershell
# Build
npm run build

# Deploy
firebase deploy --only hosting,functions

# Sjekk logs
firebase functions:log --only nextServer
```

### Deployment Sjekkliste
- [ ] Environment variabler satt i hosting platform
- [ ] Database URL konfigurert
- [ ] Secrets lagt til i Secret Manager
- [ ] Build succeeds
- [ ] Health check endpoint virker
- [ ] Smoke tests passerer
- [ ] SSL sertifikat gyldig
- [ ] Custom domain peker til deployment
- [ ] CDN konfigurert
- [ ] Monitoring aktivert

---

## 📈 POST-DEPLOYMENT

### Første 24 Timer - Monitor
- [ ] Error rates < 5%
- [ ] API latency < 2s (p95)
- [ ] Database connections stabile
- [ ] Uptime > 99.9%
- [ ] No memory leaks
- [ ] Telegram bot responder
- [ ] Wallet creation virker
- [ ] Transaction history lastes

### Health Checks
```powershell
# API health
curl https://celora-7b552.web.app/api/diagnostics/health

# Wallet summary
curl -H "Authorization: Bearer $TOKEN" https://celora-7b552.web.app/api/wallet/summary
```

### Monitoring Setup
1. **Sentry** - Error tracking
2. **Firebase Analytics** - User behavior
3. **Uptime Robot** - Uptime monitoring
4. **Helius Dashboard** - RPC usage
5. **Neon Dashboard** - Database metrics

---

## 🆘 ROLLBACK PLAN

Hvis noe går galt:

### Vercel Rollback
```powershell
# List deployments
vercel ls

# Rollback til forrige
vercel rollback
```

### Firebase Rollback
```powershell
# List releases
firebase hosting:releases:list

# Rollback
firebase hosting:rollback
```

---

## 📝 CHECKLIST - Dag for Dag

### Dag 1: Setup
- [x] Jest setup file ✅
- [ ] Installer alle dependencies
- [ ] Konfigurer environment variabler
- [ ] Setup database
- [ ] Test lokal development

### Dag 2: Sikkerhet
- [ ] Generer encryption keys
- [ ] Setup Sentry
- [ ] Setup reCAPTCHA
- [ ] Implementer rate limiting
- [ ] Security audit

### Dag 3: Testing
- [ ] Fix alle test failures
- [ ] Kjør full test suite
- [ ] E2E tests
- [ ] Security tests
- [ ] Performance testing

### Dag 4: Deployment Prep
- [ ] Setup hosting platform
- [ ] Konfigurer secrets
- [ ] Setup monitoring
- [ ] Backup database
- [ ] Dokumenter rollback prosedyre

### Dag 5: Deploy
- [ ] Deploy til staging
- [ ] Smoke tests
- [ ] Deploy til production
- [ ] Monitor første timer
- [ ] Kjør health checks

---

## 📞 SUPPORT & RESOURCES

### Dokumentasjon
- [README.md](../README.md)
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md)
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

### Eksterne Resources
- Firebase Console: https://console.firebase.google.com/project/celora-7b552
- Neon Console: https://console.neon.tech/
- Helius Dashboard: https://www.helius.dev/
- Sentry: https://sentry.io/

### Kommando Referanse
```powershell
# Development
npm run dev                    # Start dev server
npm run db:studio             # Prisma Studio

# Testing
npm test                      # Unit tests
npm run test:e2e             # E2E tests
npm run test:security        # Security tests

# Building
npm run build                 # Production build
npm run build:extension      # Browser extension

# Deployment
firebase deploy              # Deploy alt
firebase deploy --only functions
firebase deploy --only hosting

# Database
npm run db:generate          # Prisma generate
npm run db:push              # Push schema
npm run db:migrate:deploy    # Run migrations
npm run db:seed              # Seed data
```

---

## ✨ KONKLUSJON

**Estimert tid til produksjonslansering: 3-5 dager**

### Kritisk sti:
1. **Dag 1-2:** Konfigurer environment variabler og sikkerhet (8-16 timer)
2. **Dag 2-3:** Fix alle tests og security issues (8-12 timer)
3. **Dag 3-4:** Setup monitoring og deployment platform (4-8 timer)
4. **Dag 4-5:** Deploy og monitorering (4-8 timer)

### Neste steg:
1. Opprett `.env.local` fra `.env.example`
2. Generer encryption keys
3. Setup Sentry og reCAPTCHA
4. Kjør `npm test` og fiks failures
5. Deploy til staging environment

**Lykke til med lanseringen! 🚀**
