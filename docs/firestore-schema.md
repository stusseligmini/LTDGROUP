# Firestore Data Model

Multi-provider auth schema for Celora v2.

## Collections

### `users`
Top-level user profiles (doc id = Firebase `uid`).
```
{
  uid: string
  email?: string
  displayName?: string
  photoURL?: string
  createdAt: timestamp
  updatedAt: timestamp
  usernameRef?: string  // optional username doc id
  defaultWalletRef?: string
  status: 'active' | 'blocked'
  mfa?: { passkeyEnabled: boolean }
}
```

### `userAuthLinks`
Provider linkage records (doc id = random or `${provider}:${providerUid}`).
```
{
  uid: string  // Firebase uid
  provider: 'password' | 'passkey' | 'google' | 'apple' | 'telegram' | 'wallet'
  providerUid: string
  verified: boolean
  createdAt: timestamp
  updatedAt: timestamp
  meta?: {
    telegramUserId?: number
    appleSub?: string
    googleSub?: string
    walletAddress?: string
  }
}
```

### `wallets`
Wallet addresses (doc id = random).
```
{
  uid: string
  address: string
  chainId?: string
  createdAt: timestamp
  updatedAt: timestamp
  primary: boolean
  verified: boolean
}
```

### `usernames`
Username registry (doc id = lowercase username for uniqueness).
```
{
  uid: string
  name: string  // original case-preserved
  createdAt: timestamp
}
```

### `backups`
Recovery manifests (doc id = random).
```
{
  uid: string
  type: 'recovery-email' | 'passkey' | 'seed-phrase' | 'otp'
  createdAt: timestamp
  methodMeta?: any
}
```

## Security Rules Summary
- `users`: public read, owner write (uid immutable).
- `userAuthLinks`: owner read/write; uid and provider immutable after creation.
- `wallets`: public read, owner write (uid immutable).
- `usernames`: public read, create-only (doc id = lowercase name, immutable).
- `backups`: owner read/write only.

See `firestore.rules` for full rule definitions.
