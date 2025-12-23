# 🎯 RASK DEPLOYMENT GUIDE

**Alt er automatisert! Kjør bare ett script! 🚀**

---

## 🚀 RASKESTE VEI TIL DEPLOYMENT (5 minutter!)

### Windows (PowerShell):
```powershell
# Kjør deployment scriptet
.\scripts\deploy-firebase.ps1
```

### Linux/Mac (Bash):
```bash
# Gjør scriptet kjørbart
chmod +x ./scripts/deploy-firebase.sh

# Kjør deployment scriptet
./scripts/deploy-firebase.sh
```

**Scriptet gjør AUTOMATISK:**
1. ✅ Legger til alle 10 Firebase secrets
2. ✅ Builder prosjektet
3. ✅ Deployer til Firebase
4. ✅ Setter opp Telegram webhook
5. ✅ Tester health endpoint
6. ✅ Gir deg status rapport

**Estimert tid: 5-10 minutter** ⏱️

---

## 📋 FØR DU KJØRER SCRIPTET

### 1. Login til Firebase
```powershell
firebase login
firebase use celora-7b552
```

### 2. Sjekk at alt er OK
```powershell
# Test database
npx prisma db push

# Test build
npm run build

# Test lokalt (optional)
npm run dev
```

---

## 🎯 HVIS DU VIL GJØRE DET MANUELT

Se [READY_TO_DEPLOY.md](../READY_TO_DEPLOY.md) for manuelle steg.

---

## 📊 ETTER DEPLOYMENT

### Test at alt virker:

```powershell
# 1. Health check
curl https://celora-7b552.web.app/api/diagnostics/health

# 2. Åpne webapp
start https://celora-7b552.web.app

# 3. Sjekk logs
firebase functions:log --only nextServer --project=celora-7b552
```

### Test Telegram Bot:
1. Åpne Telegram
2. Søk etter boten din
3. Send `/start`
4. Klikk "Open Wallet" button

---

## 🚨 TROUBLESHOOTING

### Script feiler?
```powershell
# Sjekk Firebase login
firebase login --reauth

# Sjekk project
firebase use

# Sjekk at du er i riktig mappe
cd c:\Users\volde\Desktop\Celora-rebuld-fr
```

### Webhook virker ikke?
```powershell
# Sjekk webhook status
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Reset webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"

# Set på nytt (scriptet gjør dette automatisk)
.\scripts\deploy-firebase.ps1
```

### Health check feiler?
- Vent 2-3 minutter etter deployment
- Firebase functions tar tid å starte
- Sjekk logs: `firebase functions:log --only nextServer`

---

## ✅ SUCCESS CHECKLIST

Etter scriptet er ferdig:
- [ ] Scriptet sa "✅ Deploy successful!"
- [ ] Webhook ble satt (✅ Webhook satt!)
- [ ] Health check responderer
- [ ] Webapp åpner (https://celora-7b552.web.app)
- [ ] Telegram bot responderer

---

## 🎉 FERDIG!

**Kjør scriptet nå:**
```powershell
.\scripts\deploy-firebase.ps1
```

**Full dokumentasjon:**
- [READY_TO_DEPLOY.md](../READY_TO_DEPLOY.md) - Manuell deployment
- [NEXT_STEPS.md](../NEXT_STEPS.md) - Detaljert guide
- [DEPLOY_PLAN.md](../DEPLOY_PLAN.md) - Komplett plan
