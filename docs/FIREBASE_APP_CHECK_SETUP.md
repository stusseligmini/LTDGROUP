# Firebase App Check + WAF Setup

## What is App Check?

**Firebase App Check** protects your Firebase backend resources from abuse:
- **Firestore**: Prevents unauthorized database access
- **Cloud Functions**: Blocks direct function calls from bots
- **Cloud Storage**: Stops file upload/download abuse
- **Realtime Database**: Prevents data scraping

It works by attaching an **attestation token** to every Firebase SDK request, proving the request comes from your legitimate app (not a bot or scraper).

## App Check vs. Manual reCAPTCHA

We now have **BOTH** layers:

### Layer 1: Firebase App Check (Automatic)
- **What**: Protects Firebase backend resources automatically
- **How**: Adds attestation tokens to all Firebase SDK calls
- **Provider**: reCAPTCHA Enterprise
- **Coverage**: Firestore, Functions, Storage
- **User Experience**: Invisible (no interaction needed)

### Layer 2: Manual reCAPTCHA Assessments (Custom)
- **What**: Protects custom logic (wallet creation, transactions, auth)
- **How**: Explicit verification before sensitive operations
- **Provider**: reCAPTCHA Enterprise (same key)
- **Coverage**: Your custom API routes
- **User Experience**: Invisible (background scoring)

**They complement each other perfectly!**

## Setup Steps

### 1. Enable App Check in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/celora-7b552/appcheck)
2. Click **Get Started**
3. Select **Web** app
4. Choose **reCAPTCHA Enterprise** as provider
5. Click **Register**

### 2. Enable WAF Integration (Your Screenshot)

When creating the reCAPTCHA key:
1. ✅ **Check**: "Will you deploy this key in a Web Application Firewall (WAF)?"
2. **Service provider**: Cloud Armor
3. **Feature**: Action (as shown in your screenshot)

This enables:
- **WAF challenge injection**: Cloud Armor can automatically challenge suspicious requests
- **Firewall policies**: Auto-block based on reCAPTCHA score
- **Rate limiting**: Combined with reCAPTCHA scoring

### 3. Configure Security Rules (Firestore)

Update `firestore.rules` to require App Check:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require App Check token for all writes
    match /{document=**} {
      allow read: if true; // Public reads (adjust as needed)
      allow write: if request.auth != null && request.app != null;
      //                                       ^^^^^^^^^^^^^^^^
      //                                       App Check verification
    }
    
    // Example: Require App Check for sensitive collections
    match /wallets/{walletId} {
      allow read, write: if request.auth.uid == walletId && request.app != null;
    }
    
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId && request.app != null;
    }
  }
}
```

### 4. Configure Functions (Optional)

Require App Check in Cloud Functions:

```typescript
// functions/index.js
import { onCall } from 'firebase-functions/v2/https';

export const createWallet = onCall(
  {
    // Require App Check token
    consumeAppCheckToken: true,
  },
  async (request) => {
    // request.app will be populated if App Check succeeded
    if (!request.app) {
      throw new Error('App Check verification failed');
    }
    
    // Proceed with wallet creation...
  }
);
```

### 5. Test App Check

```typescript
import { verifyAppCheck } from '@/lib/firebase/appCheck';

// Check if App Check is working
const isWorking = await verifyAppCheck();
console.log('App Check status:', isWorking);
```

## How It Works Together

### Example: Wallet Creation Flow

```typescript
// 1. Firebase App Check (Automatic)
// - Client: Firebase SDK auto-attaches App Check token to Firestore write
// - Server: Firestore verifies token, checks against `request.app != null` rule
// - Result: Bot requests blocked at Firebase level

// 2. Manual reCAPTCHA (Explicit)
// - Client: Execute reCAPTCHA before showing wallet form
const verification = await executeAndVerifyRecaptcha(executeRecaptcha, 'wallet_create');
if (!verification.success) return; // Block low scores

// - Server: Your API route verifies token via reCAPTCHA Enterprise API
const { verified } = await verifyToken(token, 'wallet_create', { minScore: 0.7 });
if (!verified) return res.status(403);

// Result: Double protection - Firebase blocks unauthorized access, 
// your API blocks bots/fraud
```

### Example: Transaction Flow

```typescript
// 1. App Check protects the Firestore transaction log write
await addDoc(collection(db, 'transactions'), {
  from: walletAddress,
  to: recipientAddress,
  amount: 1.5,
  timestamp: serverTimestamp(),
});
// App Check token automatically attached ^

// 2. Manual reCAPTCHA protects the transaction submission
const verification = await executeAndVerifyRecaptcha(executeRecaptcha, 'transaction');
if (verification.score < 0.5) {
  toast.error('Security verification failed');
  return;
}
// Explicit verification for high-risk operation ^
```

## WAF Integration Benefits

With WAF (Web Application Firewall) enabled:

1. **Cloud Armor Integration**
   - Automatically challenge requests with low reCAPTCHA scores
   - Block traffic from suspicious IPs/regions
   - Rate limit based on reCAPTCHA risk score

2. **Firewall Policies**
   - Create rules like: "Block if score < 0.3"
   - Geographic blocking: "Block if country = X AND score < 0.5"
   - Custom logic: "Challenge if score < 0.7 AND path = /api/wallet/create"

3. **Zero Configuration Needed** (After Setup)
   - Cloud Armor automatically uses reCAPTCHA scores
   - No code changes required
   - Works at CDN edge (faster than app-level blocking)

## Setup Checklist

- [x] reCAPTCHA Enterprise API enabled
- [x] reCAPTCHA key created with WAF integration
- [x] App Check initialized in `src/lib/firebase/client.ts`
- [ ] App Check registered in Firebase Console
- [ ] Firestore rules updated with `request.app != null`
- [ ] WAF policies created (optional)
- [ ] Test App Check token generation
- [ ] Monitor App Check metrics in Firebase Console

## Monitoring

### Firebase Console
- [App Check Dashboard](https://console.firebase.google.com/project/celora-7b552/appcheck)
- Token verification metrics
- Failed verification attempts
- App Check token usage

### reCAPTCHA Console  
- [reCAPTCHA Dashboard](https://console.cloud.google.com/security/recaptcha?project=celora-7b552)
- Score distribution
- WAF integration status
- Firewall policy triggers

## Debugging

**App Check not working?**

```typescript
// Check token generation
import { getAppCheckToken } from '@/lib/firebase/appCheck';
const token = await getAppCheckToken();
console.log('App Check token:', token);
```

**Firestore writes failing?**

```javascript
// Check Firestore rules
// Ensure you have: request.app != null

// Check browser console for errors like:
// "AppCheck: Fetch server returned an HTTP error status. HTTP status: 403"
```

**Debug mode (development)**

```bash
# Add to .env.local
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=true

# Get debug token from Firebase Console
# https://console.firebase.google.com/project/celora-7b552/appcheck/apps
```

## Cost

- **App Check**: Free (included in Firebase Spark/Blaze plans)
- **reCAPTCHA Enterprise**: $1 per 1,000 assessments after 10k free/month
- **Cloud Armor (WAF)**: $0.75/month + $0.0075 per 10k requests

Estimated total: **$5-15/month** for typical crypto wallet traffic.

## Next Steps

1. ✅ Register app in Firebase App Check console
2. ✅ Update Firestore rules with `request.app != null`
3. ✅ Deploy and test
4. ⏳ Create WAF firewall policies (optional)
5. ⏳ Monitor App Check dashboard

## Documentation

- [Firebase App Check Docs](https://firebase.google.com/docs/app-check)
- [reCAPTCHA Enterprise + WAF](https://cloud.google.com/recaptcha-enterprise/docs/waf-integration)
- [Cloud Armor Firewall Policies](https://cloud.google.com/armor/docs/configure-security-policies)
