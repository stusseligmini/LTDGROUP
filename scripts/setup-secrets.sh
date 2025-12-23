#!/bin/bash

# Setup Firebase Secret Manager secrets for Celora
# Run this once to create/update secrets in Firebase

PROJECT_ID="celora-7b552"

echo "Setting up Firebase Secret Manager secrets for project: $PROJECT_ID"
echo ""

# GCP_PRIVATE_KEY - Firebase Admin SDK private key
echo "Setting GCP_PRIVATE_KEY..."
firebase functions:secrets:set GCP_PRIVATE_KEY --project=$PROJECT_ID << 'EOF'
YOUR_FIREBASE_PRIVATE_KEY_PEM
EOF
YOUR_FIREBASE_PRIVATE_KEY_PEM
EOF

# RECAPTCHA_SECRET_KEY
echo "Setting RECAPTCHA_SECRET_KEY..."
firebase functions:secrets:set RECAPTCHA_SECRET_KEY --project=$PROJECT_ID << 'EOF'
6Lc3DR4sAAAAACtkkins-KKhXMLDTYhJswozlJ44
EOF

# TELEGRAM_BOT_TOKEN
echo "Setting TELEGRAM_BOT_TOKEN..."
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project=$PROJECT_ID << 'EOF'
YOUR_TELEGRAM_BOT_TOKEN
EOF

# TELEGRAM_WEBHOOK_SECRET
echo "Setting TELEGRAM_WEBHOOK_SECRET..."
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET --project=$PROJECT_ID << 'EOF'
YOUR_TELEGRAM_WEBHOOK_SECRET
EOF

echo ""
echo "All secrets set successfully!"
echo "Secrets are now managed by Google Secret Manager."
echo ""
echo "Next steps:"
echo "1. Run: npm run build"
echo "2. Run: firebase deploy --only hosting,functions"
