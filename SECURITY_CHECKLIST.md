# 🔐 SECURITY CHECKLIST - ACTION REQUIRED

## ✅ COMPLETED
- [x] .env.local er i .gitignore
- [x] DATABASE_URL er secret i apphosting.yaml
- [x] Firebase API key korrekt konfigurert (public er OK)

## 🔴 CRITICAL - DO IMMEDIATELY

### 1. Roter Telegram Bot Token
**Hvorfor:** Token gir full kontroll over boten din
**Hvor:** [@BotFather](https://t.me/botfather) på Telegram
**Steg:**
1. Send `/mybots` til @BotFather
2. Velg din bot
3. Velg "API Token" → "Revoke current token"
4. Kopier nytt token
5. Oppdater `.env.local` og Firebase Secret Manager

### 2. Roter Neon Database Password (hvis delt)
**Hvorfor:** Passord gir full database tilgang
**Hvor:** [Neon Console](https://console.neon.tech/)
**Steg:**
1. Gå til ditt Neon prosjekt
2. Settings → Reset password
3. Kopier nytt DATABASE_URL
4. Oppdater `.env.local` og Firebase Secret Manager

### 3. Roter Helius API Key (valgfri men anbefalt)
**Hvorfor:** Forhindre rate limit abuse
**Hvor:** [Helius Dashboard](https://dashboard.helius.dev/)
**Steg:**
1. Gå til API Keys
2. Revoke old key og generer ny
3. Oppdater `.env.local` og Firebase Secret Manager

## 🟡 IMPORTANT - DO BEFORE PRODUCTION

### 4. Sett opp Firebase Secrets i Secret Manager
```bash
# Fra terminal:
firebase apphosting:secrets:set DATABASE_URL
# Paste verdien fra .env.local

firebase apphosting:secrets:set DIRECT_DATABASE_URL
firebase apphosting:secrets:set HELIUS_API_KEY
firebase apphosting:secrets:set TELEGRAM_BOT_TOKEN
firebase apphosting:secrets:set TELEGRAM_WEBHOOK_SECRET
```

### 5. Konfigurer Firebase API Key Restrictions
**Hvor:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
**Steg:**
1. Finn "Browser key (auto created by Firebase)"
2. Under "Application restrictions" → velg "HTTP referrers"
3. Legg til:
   - `celora.vercel.app/*`
   - `*.firebaseapp.com/*`
   - `localhost:3000/*` (kun for dev)

### 6. Enable Firebase App Check
**Hvor:** Firebase Console → App Check
**Steg:**
1. Enable reCAPTCHA Enterprise provider
2. Sett enforcement mode til "Enforced" for production

### 7. Test Firebase Security Rules
**Filer å sjekke:**
- `firestore.rules`
- `storage.rules` (hvis du bruker Storage)

**Test:**
```bash
firebase emulators:start --only firestore
# Kjør tester mot emulator
```

## 🟢 RECOMMENDED - DO WHEN CONVENIENT

### 8. Rate Limiting på API routes
- Implementer rate limiting på `/api/*` routes
- Bruk Vercel Edge Config eller Upstash Redis

### 9. CORS Configuration
- Sett opp strict CORS policies for API endpoints
- Whitelist kun tillatte domener

### 10. Monitoring & Alerts
- Sett opp Sentry/Error tracking
- Enable Firebase Crashlytics
- Konfigurer budget alerts i Google Cloud

## 📝 SECRETS MANAGEMENT BEST PRACTICES

### ✅ DO:
- Bruk Firebase Secret Manager for production
- Bruk `.env.local` for lokal utvikling (gitignored)
- Roter secrets regelmessig (hver 90 dag)
- Bruk forskjellige secrets for dev/staging/prod

### ❌ DON'T:
- Commit `.env*` filer til Git (unntatt `.env.example`)
- Del secrets i Slack/Discord/Email
- Hardkode secrets i kode
- Bruk samme secrets i flere prosjekter
- Logg secrets til console/filer

## 🚨 IF SECRETS ARE LEAKED

1. **IMMEDIATELY** rotate all affected secrets
2. Check Git history: `git log --all --full-history --source -- .env*`
3. If committed to Git: Contact GitHub support + rotate ALL secrets
4. Review access logs for unauthorized access
5. Enable 2FA på alle tjenester
6. Consider BFG Repo-Cleaner for Git history: https://rtyley.github.io/bfg-repo-cleaner/

## 📞 SUPPORT CONTACTS

- Firebase: https://firebase.google.com/support
- Neon: https://neon.tech/docs/introduction/support
- Helius: https://docs.helius.dev/
- Telegram: https://core.telegram.org/bots/faq

---
**Last Updated:** 2025-12-22
**Review Status:** ⚠️ ACTION REQUIRED
