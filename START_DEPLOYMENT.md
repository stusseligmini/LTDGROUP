# KJØR DEPLOYMENT NÅ!

## RASK START (3 kommandoer)

```powershell
# 1. Test at scriptet fungerer
Get-Content .\scripts\deploy-firebase.ps1 | Select-Object -First 5

# 2. Kjør deployment!
.\scripts\deploy-firebase.ps1

# 3. Følg instruksjonene på skjermen
# - Trykk 'y' når scriptet spør
# - Vent mens det jobber
# - Ferdig på 5-10 minutter!
```

---

## HVA SCRIPTET GJØR

1. **Sjekker Firebase CLI** - At du er logget inn
2. **Legger til 10 secrets** - Alle encryption keys og tokens
3. **Builder prosjektet** - Production build
4. **Deployer til Firebase** - Hosting + Functions
5. **Setter opp webhook** - Telegram bot
6. **Tester deployment** - Health check

---

## FORVENTET OUTPUT

```
=== CELORA - FIREBASE DEPLOYMENT SCRIPT ===
===========================================

[CHECK] Sjekker Firebase CLI...
[OK] Firebase CLI installert: 14.26.0

[STEG 1] Legger til Firebase Secrets...

Vil legge til 10 secrets i Firebase...

Fortsett? (y/n): y

[ADD] Legger til: DATABASE_URL
      Neon PostgreSQL Database URL
      [OK] Success!

[ADD] Legger til: TELEGRAM_BOT_TOKEN
      Telegram Bot Token
      [OK] Success!

... (fortsetter for alle 10 secrets)

[OK] Alle secrets lagt til!

[STEG 2] Building prosjekt...
(npm run build output...)
[OK] Build successful!

[STEG 3] Deployer til Firebase...

Klar for a deploye til produksjon? (y/n): y

(firebase deploy output...)
[OK] Deploy successful!

[STEG 4] Setter opp Telegram Webhook...
[OK] Webhook satt!

=== DEPLOYMENT FULLFORT! ===

[TEST] Test din deployment:
1. Health check: curl https://celora-7b552.web.app/api/diagnostics/health
2. Apne webapp: https://celora-7b552.web.app
3. Test Telegram bot
4. Sjekk logs: firebase functions:log --only nextServer

[OK] Health check passed!

=== SUCCESS! Din wallet app er live! ===
```

---

## HVIS SCRIPTET FEILER

### Parser Error / Encoding Error
Scriptet er nå fikset uten emoji - skal fungere!

### Firebase Login Error
```powershell
firebase login --reauth
firebase use celora-7b552
```

### Build Error
```powershell
rm -rf .next
npm install
npm run build
```

### Deploy Error
```powershell
# Sjekk at du er i riktig mappe
pwd
# Skal være: C:\Users\volde\Desktop\Celora-rebuld-fr

# Prøv igjen
.\scripts\deploy-firebase.ps1
```

---

## ETTER DEPLOYMENT

### Test alt virker:

```powershell
# 1. Health check
curl https://celora-7b552.web.app/api/diagnostics/health

# 2. Åpne webapp i browser
start https://celora-7b552.web.app

# 3. Sjekk logs
firebase functions:log --only nextServer --project=celora-7b552
```

### Test Telegram Bot:
1. Åpne Telegram
2. Søk etter boten din
3. Send `/start`
4. Klikk "Open Wallet" button
5. Webapp skal åpne i Telegram

---

## READY? START NÅ!

```powershell
.\scripts\deploy-firebase.ps1
```

**Estimert tid: 5-10 minutter**

God lansering! 🚀
