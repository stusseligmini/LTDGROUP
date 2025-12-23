# Celora Extension - Quick Start

## Load the Extension in Chrome

1. **Build the extension** (if not already built):
   ```powershell
   npm run build:extension
   ```

2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions`
   - Toggle **Developer mode** ON (top right)

3. **Load unpacked extension**:
   - Click **Load unpacked**
   - Select the `extension` folder in this repo
   - The Celora icon should appear in your extensions toolbar

4. **Open the popup**:
   - Click the Celora icon
   - Click the **Celora Lock** card to open the web app
   - The fallback ensures instant access even if React doesn't mount

## Features

### Fallback Lock UI
- **Instant open**: Clicking the cyan "Celora Lock" card opens `https://celora-7b552.web.app` in a new tab
- **Always works**: Pure HTML/CSS/JS, no dependencies, guaranteed functionality

### React Popup (Optional)
- Full authentication with Firebase (email/password or anonymous)
- Quick wallet overview, cards, and notifications tabs
- Error handling with retry for network failures

### API Integration
- `/api/settings` endpoint for user preferences
- Auth via `Authorization: Bearer <token>` header (priority) or cookies (fallback)
- `/api/auth/session` for setting httpOnly cookies from extension

## Auth Flow

1. **Anonymous Entry** (fastest):
   - Click lock → Click "Login" with no credentials → Anonymous sign-in → Wallet access

2. **Email/Password**:
   - Click lock → Enter email + password → Click "Login" → Full account access

3. **Token Propagation**:
   - `AuthProvider` calls `setApiAuthToken(token)` after sign-in
   - `apiClient` adds `Authorization: Bearer <token>` to all requests
   - Server's `getUserIdFromRequest` verifies token and extracts user ID

## Error Handling

Extension includes `errorHandler.ts` with:
- Firebase error mapping (auth codes → friendly messages)
- API error mapping (HTTP status → user-friendly text)
- Retry with exponential backoff for network errors
- UI-ready error formatting with retry indicators

## Manifest Permissions

- `host_permissions`: Includes `https://celora-7b552.web.app/*` for API calls
- `storage`: For caching auth state
- `notifications`: For transaction alerts
- CSP-compliant: No inline scripts, IIFE bundles only

## Development

- **Update popup UI**: Edit `extension/src/popup.tsx` (React component)
- **Update styles**: Edit `extension/popup.css`
- **Update fallback**: Edit `extension/popup.html` (pure HTML lock card)
- **Rebuild**: Run `npm run build:extension`
- **Reload extension**: Click reload icon in `chrome://extensions`

## Troubleshooting

**Lock doesn't respond**:
- Check console for `[Home] Lock clicked` log
- Verify no CSS overlays blocking clicks
- Fallback lock in popup.html should always work

**API returns 401**:
- Check Firebase ID token is set after login
- Verify `Authorization: Bearer` header in Network tab
- Try `/api/auth/session` POST to set cookies as backup

**React popup doesn't mount**:
- Fallback lock still works for opening app
- Check console for React errors
- Verify `dist/popup.js` exists after build

## Files

```
extension/
├── manifest.json          # MV3 manifest with permissions
├── popup.html             # Fallback lock UI (always works)
├── popup.css              # Styles for fallback + React
├── src/
│   ├── popup.tsx          # React popup component
│   ├── errorHandler.ts    # Error mapping utilities
│   ├── messaging.ts       # Extension messaging
│   └── security.ts        # Security utilities
├── background/
│   └── service-worker.js  # Background tasks
└── dist/                  # Built files (generated)
    ├── popup.js
    └── background/
        └── service-worker.js
```
