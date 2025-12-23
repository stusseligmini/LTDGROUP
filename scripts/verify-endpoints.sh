#!/bin/bash

# Verification script for Celora endpoints
# Tests wallet summary and Telegram auth endpoints

HOSTING_URL="https://celora-7b552.web.app"
USER_ID="test_user_123"
BEARER_TOKEN="test_token_456"

echo "=== Celora Endpoint Verification ==="
echo ""

# Test 1: Wallet Summary Endpoint
echo "1. Testing /api/wallet/summary..."
echo "   (GET with x-user-id header)"
curl -s -X GET \
  -H "x-user-id: $USER_ID" \
  -H "authorization: Bearer $BEARER_TOKEN" \
  "$HOSTING_URL/api/wallet/summary" | jq '.'
echo ""

# Test 2: Telegram Auth (should fail with invalid initData)
echo "2. Testing /api/telegram/auth with invalid initData (should return 400)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456, "initData": "invalid"}' \
  "$HOSTING_URL/api/telegram/auth" | jq '.'
echo ""

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "- Wallet Summary should return { totalBalance, currency, holdings, lastUpdated }"
echo "- Telegram Auth should return 400 (invalid initData) or 401 (invalid signature)"
echo "- CSRF tokens should be set on GET requests and validated on POST"
