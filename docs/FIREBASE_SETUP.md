# Firebase Cloud SQL Setup Guide

## 📋 Prerequisites
- Firebase project: `celora-7b552`
- Google Cloud project: `celora-7b552`
- GitHub repository connected to Firebase App Hosting

---

## 1️⃣ Create Cloud SQL Instance

### Via Google Cloud Console (Recommended)

1. **Go to Cloud SQL:**
   https://console.cloud.google.com/sql/instances?project=celora-7b552

2. **Create Instance:**
   - Click "CREATE INSTANCE"
   - Choose "PostgreSQL"
   - Instance ID: `celora-db`
   - Password: [Choose a strong password - save it!]
   - Database version: PostgreSQL 15
   - Region: `us-central1` (same as Firebase)
   - Zonal availability: Single zone (cheaper)

3. **Configuration:**
   - **Machine type:** Shared core (1 vCPU, 0.614 GB) - FREE TIER
   - **Storage:** 10 GB SSD (default)
   - **Connections:** Private IP (default is fine)
   - **Automated backups:** Enabled (recommended)

4. **Click "CREATE INSTANCE"** (takes ~5 minutes)

### Via gcloud CLI (Alternative)

```bash
# Create Cloud SQL instance
gcloud sql instances create celora-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --project=celora-7b552 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create celora \
  --instance=celora-db \
  --project=celora-7b552
```

---

## 2️⃣ Create Database

1. **Go to your Cloud SQL instance:**
   https://console.cloud.google.com/sql/instances/celora-db/databases?project=celora-7b552

2. **Click "CREATE DATABASE"**
   - Database name: `celora`
   - Character set: UTF8 (default)
   - Collation: Default

3. **Click "CREATE"**

---

## 3️⃣ Store Secrets in Secret Manager

### Connection Strings Format:
```
postgresql://postgres:YOUR_PASSWORD@/celora?host=/cloudsql/celora-7b552:us-central1:celora-db
```

### Via Secret Manager Console:

1. **Go to Secret Manager:**
   https://console.cloud.google.com/security/secret-manager?project=celora-7b552

2. **Create each secret:** (Click "CREATE SECRET" for each)

#### Database Secrets:
- **Name:** `database-url`
  - **Value:** `postgresql://postgres:YOUR_PASSWORD@/celora?host=/cloudsql/celora-7b552:us-central1:celora-db`

- **Name:** `direct-database-url`
  - **Value:** Same as `database-url`

#### Encryption Secrets:
- **Name:** `master-encryption-key`
  - **Value:** `74f0037b0f1c4a059b2bd21e6eab515140018fd7bdbd55f78463244fcee65a18`

- **Name:** `wallet-encryption-key`
  - **Value:** `e673e0175990667f6dd6e4ec331c308cf1b985a8046af6732c2421e17cc32e6d`

- **Name:** `session-cookie-secret`
  - **Value:** `4fad6dc3d38dcc1cccc98fc1007977a8`

- **Name:** `encryption-key`
  - **Value:** `72e1959249461b66b4d5a9e06aba0289b33874ec99dca2934f25c909009273cb`

- **Name:** `encryption-salt`
  - **Value:** `0c29fd9635ea4dfeb2cee894fd8abbbc8971ef87552f6a3c66f0e13b08d081ee`

### Via gcloud CLI (Faster):

```bash
# Set your Cloud SQL password
CLOUD_SQL_PASSWORD="your_secure_password_here"

# Database connection strings
echo -n "postgresql://postgres:${CLOUD_SQL_PASSWORD}@/celora?host=/cloudsql/celora-7b552:us-central1:celora-db" | \
  gcloud secrets create database-url --data-file=- --project=celora-7b552

echo -n "postgresql://postgres:${CLOUD_SQL_PASSWORD}@/celora?host=/cloudsql/celora-7b552:us-central1:celora-db" | \
  gcloud secrets create direct-database-url --data-file=- --project=celora-7b552

# Encryption keys
echo -n "74f0037b0f1c4a059b2bd21e6eab515140018fd7bdbd55f78463244fcee65a18" | \
  gcloud secrets create master-encryption-key --data-file=- --project=celora-7b552

echo -n "e673e0175990667f6dd6e4ec331c308cf1b985a8046af6732c2421e17cc32e6d" | \
  gcloud secrets create wallet-encryption-key --data-file=- --project=celora-7b552

echo -n "4fad6dc3d38dcc1cccc98fc1007977a8" | \
  gcloud secrets create session-cookie-secret --data-file=- --project=celora-7b552

echo -n "72e1959249461b66b4d5a9e06aba0289b33874ec99dca2934f25c909009273cb" | \
  gcloud secrets create encryption-key --data-file=- --project=celora-7b552

echo -n "0c29fd9635ea4dfeb2cee894fd8abbbc8971ef87552f6a3c66f0e13b08d081ee" | \
  gcloud secrets create encryption-salt --data-file=- --project=celora-7b552
```

---

## 4️⃣ Grant Firebase App Hosting Access to Secrets

### Via gcloud CLI:

```bash
# Get service account
PROJECT_NUMBER=$(gcloud projects describe celora-7b552 --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to all secrets
for secret in database-url direct-database-url master-encryption-key wallet-encryption-key session-cookie-secret encryption-key encryption-salt; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=celora-7b552
done
```

### Via Console (Alternative):

1. Go to each secret in Secret Manager
2. Click "PERMISSIONS" tab
3. Click "GRANT ACCESS"
4. Add principal: `[PROJECT_NUMBER]-compute@developer.gserviceaccount.com`
5. Role: "Secret Manager Secret Accessor"
6. Click "SAVE"

---

## 5️⃣ Connect Firebase App Hosting to Cloud SQL

### Via Firebase Console:

1. **Go to Firebase App Hosting:**
   https://console.firebase.google.com/project/celora-7b552/apphosting

2. **Select your backend service** (or create one if not exists)

3. **Go to "Settings" or "Integrations"**

4. **Find "Cloud SQL connections"**

5. **Click "Add connection"**

6. **Select:** `celora-7b552:us-central1:celora-db`

7. **Save**

### Verification:

The connection should appear in your `apphosting.yaml`:
```yaml
cloudSqlInstances:
  - celora-7b552:us-central1:celora-db
```

---

## 6️⃣ Deploy to Firebase

### Automatic Deployment:

```bash
# Commit and push changes
git add apphosting.yaml
git commit -m "feat: Add Firebase Cloud SQL configuration"
git push origin main
```

Firebase App Hosting will automatically:
1. ✅ Detect the push to main branch
2. ✅ Run `npm ci --legacy-peer-deps`
3. ✅ Run `npx prisma generate`
4. ✅ Run `npx prisma migrate deploy`
5. ✅ Run `npm run build`
6. ✅ Deploy to Cloud Run
7. ✅ Connect to Cloud SQL via Unix socket

### Manual Deployment (via Firebase CLI):

```bash
# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login
firebase login

# Deploy
firebase apphosting:backends:create celora-backend \
  --project=celora-7b552 \
  --location=us-central1
```

---

## 7️⃣ Verify Deployment

### Check Build Status:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/celora-7b552/apphosting

2. **Check latest build:**
   - Status should be "Success" ✅
   - Build logs should show:
     - ✅ Prisma Client generated
     - ✅ Migrations applied
     - ✅ Next.js built successfully

### Test Database Connection:

```bash
# Once deployed, test the health endpoint
curl https://YOUR-APP-URL/api/diagnostics/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T...",
  "database": "connected",
  "services": {...}
}
```

---

## 🔍 Troubleshooting

### Issue: Build fails with "npm ci" errors
**Solution:** Regenerate `package-lock.json` locally using Node 24/npm 11, commit it, then push. Ensure `.npmrc` is checked in and consider `omit=dev=true` for App Hosting builds.

### Issue: "Environment variable not found: DATABASE_URL"
**Solution:** Verify secrets are created in Secret Manager and service account has access

### Issue: "Cannot connect to Cloud SQL"
**Solution:** 
- Verify Cloud SQL instance is running
- Check `cloudSqlInstances` in apphosting.yaml
- Ensure Unix socket path is correct: `/cloudsql/celora-7b552:us-central1:celora-db`

### Issue: "Prisma migrate deploy failed"
**Solution:**
- Check database credentials in secrets
- Verify database `celora` exists in Cloud SQL instance
- Check Cloud SQL instance is not paused

---

## 📊 Cost Estimate

### Free Tier (Expected usage):
- **Cloud SQL:** db-f1-micro (FREE for first instance)
- **Firebase App Hosting:** FREE for basic usage
- **Secret Manager:** FREE for 6 secrets + 10,000 accesses/month
- **Cloud Run:** FREE for first 2 million requests

### After Free Tier:
- Cloud SQL: ~$10/month (shared core)
- App Hosting: Pay-as-you-go (typically $5-20/month for small apps)

---

## ✅ Checklist

Before deploying, ensure:

- [ ] Cloud SQL instance `celora-db` created
- [ ] Database `celora` created in Cloud SQL
- [ ] All 7 secrets created in Secret Manager
- [ ] Service account has Secret Manager access
- [ ] `apphosting.yaml` exists in project root
- [ ] `package-lock.json` is synced (commit 67d70e9) ✅
- [ ] GitHub repository connected to Firebase App Hosting
- [ ] Latest code pushed to main branch

---

## 🚀 Next Steps

After successful deployment:

1. **Run database migrations** (automatically done during build)
2. **Test authentication** with Firebase Authentication
3. **Test wallet creation** functionality
4. **Monitor logs** in Firebase Console
5. **Set up custom domain** (optional)
6. **Enable Cloud CDN** for better performance (optional)

---

## 🔐 Local Firebase Admin Credentials

For server-side token verification in local development, the Firebase Admin SDK needs credentials. Provide them via a service account JSON or decomposed env vars.

1) Point to the service account JSON:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\volde\Desktop\Celora rebuild\CeloraV2\firebase-admin-key.json"; npm run start
```

2) Or use decomposed env vars in `.env.local`:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...escaped newlines...\n-----END PRIVATE KEY-----\n"
```

When credentials are missing, Admin may fall back to default credentials and not validate tokens. In development, consider gating server auth to return a friendly 401 instead of blocking flows.

## 🧪 Troubleshooting (Local)

- Red banner “Developer tools detected”: client safety warning; close devtools or gate the banner behind `NODE_ENV !== 'development'`.
- Admin credential warning: set `GOOGLE_APPLICATION_CREDENTIALS` or the decomposed env vars above.

---

## 📚 Resources

- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Cloud SQL for PostgreSQL](https://cloud.google.com/sql/docs/postgres)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Prisma with Cloud SQL](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-google-cloud-run)
