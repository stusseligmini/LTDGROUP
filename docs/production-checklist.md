# Production Deployment Checklist (Non-Custodial)

Focus: User key safety, deterministic builds, minimal infra.

## Environment Variables
- [ ] RPC_PROVIDER_URL (Solana)
- [ ] SECONDARY_RPC_URL (fallback)
- [ ] TELEGRAM_BOT_TOKEN
- [ ] TELEGRAM_WEBHOOK_SECRET
- [ ] MOONPAY_PUBLIC_KEY / MOONPAY_API_KEY (optional fiat)
- [ ] JUPITER_SWAP_API (if custom)
- [ ] DATABASE_URL (public metadata only)
- [ ] SENTRY_DSN (optional)
- [ ] PRICE_FEED_API_URL

## Pre-Flight
- [ ] No private key storage server-side.
- [ ] Seed phrase UI tested (create/import/backup).
- [ ] Encryption routine audited.
- [ ] Dependency audit passes (no high severity vulns).
- [ ] Bundle size acceptable (< target threshold for perf).
- [ ] CSP headers active in prod.
- [ ] Error tracking redacts sensitive data.

## Data Validation
- [ ] Username uniqueness constraint.
- [ ] Address format validation (Solana base58) client + server.
- [ ] Rate limit on username registration endpoint.

## Performance
- [ ] RPC latency baseline recorded.
- [ ] WebSocket reconnect logic implemented.
- [ ] Caching strategy: in-memory + short-lived client caches.

## Observability
- [ ] Basic heartbeat script deployed.
- [ ] Alert webhook configured.
- [ ] Swap / buy flow success metrics logged (count only).

## Security
- [ ] No eval / dynamic code injection.
- [ ] Encryption key derivation uses PBKDF2 / Argon2id with strong params.
- [ ] Sensitive components rendered in isolation route.

## Final
- [ ] Extension build signed.
- [ ] Mobile builds uploaded (TestFlight / Play Store internal).
- [ ] Documentation updated (user backup instructions).
- [ ] Privacy policy reflects non-custodial nature.

## Post-Deploy
- [ ] Monitor errors first 24h.
- [ ] Collect user feedback.
- [ ] Plan incremental releases (swap, cards, casino presets).


### Database
- [ ] Database migrations are up to date (`prisma migrate deploy`)
- [ ] Database backup is taken before migration
- [ ] Connection pooling (PgBouncer) is configured for production
- [ ] Database indexes are optimized
- [ ] Row-Level Security (RLS) policies are enabled
- [ ] Audit log retention policy is configured

### Infrastructure
- [ ] Hosting platform selected and sized (Vercel / container / edge)
- [ ] Basic telemetry enabled (errors + performance) without vendor lock-in
- [ ] CDN + DDoS protection (provider native or third-party) configured
- [ ] SSL certificates valid and auto-renewal confirmed
- [ ] Custom domain pointed and verified
- [ ] WAF or equivalent filtering (optional if low attack surface)
- [ ] Auto-scaling / concurrency limits reviewed
- [ ] Health check endpoint responds with JSON status

### Security
- [ ] All secrets have been rotated in the last 90 days
- [ ] Security audit has been performed
- [ ] CORS origins are restricted to production domains only
- [ ] Content Security Policy (CSP) headers are configured
- [ ] Rate limiting is enabled on API endpoints
- [ ] DDoS protection is active
- [ ] Security headers are configured (X-Frame-Options, etc.)

### Code Quality
- [ ] All tests pass (unit, integration, E2E)
- [ ] Code coverage is above 70%
- [ ] No critical security vulnerabilities in dependencies
- [ ] Linting passes without errors
- [ ] TypeScript compilation succeeds
- [ ] Build completes successfully

### Monitoring & Alerts
- [ ] Application Insights is collecting telemetry
- [ ] Alert rules are configured for:
  - [ ] High error rate (>5% of requests)
  - [ ] High API latency (>2s p95)
  - [ ] Database connection failures
  - [ ] Low availability (<99.9%)
  - [ ] High exception rate
- [ ] On-call rotation is set up
- [ ] Incident response plan is documented

## Deployment Steps

1. [ ] Merge to `main` branch (triggers CI pipeline)
2. [ ] Wait for CI pipeline to complete successfully
3. [ ] Verify staging deployment is successful
4. [ ] Run smoke tests on staging
5. [ ] Deploy to production:
   ```bash
   # Example manual deployment (generic container push)
   docker build -t celora-app:prod .
   docker tag celora-app:prod registry.example.com/celora-app:prod
   docker push registry.example.com/celora-app:prod
   ```
6. [ ] Run database migrations:
   ```bash
   # Run migrations (generic)
   npx prisma migrate deploy
   # Optionally skip validations for transient deploy scenarios
   ```
7. [ ] Verify deployment via hosting provider dashboard

## Post-Deployment Verification

### Health Checks
- [ ] Health endpoint responds: `GET /api/diagnostics/health`
- [ ] Response time is <500ms
- [ ] All dependencies (database, Redis) are connected

### Critical Endpoints
- [ ] Authentication flow works: `/signin`, `/signup`
- [ ] Wallet summary API: `GET /api/wallet/summary`
- [ ] Transaction API: `GET /api/transactions`
- [ ] Card API: `GET /api/cards`
- [ ] Telegram webhook: `POST /api/telegram/webhook`

### User Flows
- [ ] User can sign in
- [ ] User can create/view wallets
- [ ] User can view transaction history
- [ ] User can create virtual cards (if enabled)
- [ ] Telegram bot responds to commands

### Monitoring
- [ ] Application Insights shows no errors
- [ ] Response times are within acceptable range
- [ ] Database query performance is normal
- [ ] No memory leaks or resource exhaustion
- [ ] Alert rules are not triggering false positives

### Rollback Plan
- [ ] Previous deployment version is identified
- [ ] Rollback procedure is documented
- [ ] Team knows how to execute rollback
- [ ] Rollback can be completed within 15 minutes

## Communication

- [ ] Deployment announcement sent to team
- [ ] Stakeholders notified of deployment
- [ ] Monitoring dashboard is shared
- [ ] On-call engineer is aware of deployment

## Post-Deployment (First 24 Hours)

- [ ] Monitor error rates closely
- [ ] Check Application Insights for anomalies
- [ ] Verify user reports (if any)
- [ ] Review performance metrics
- [ ] Check database performance
- [ ] Verify all scheduled jobs are running
- [ ] Monitor Telegram bot activity

## Emergency Rollback

If critical issues are detected:

1. [ ] Identify the issue and severity
2. [ ] Notify team and stakeholders
3. [ ] Execute rollback:
   ```bash
   az webapp deployment slot swap \
     --name <PRODUCTION_WEBAPP_NAME> \
     --resource-group <RESOURCE_GROUP> \
     --slot staging \
     --target-slot production
   ```
4. [ ] Verify rollback was successful
5. [ ] Document the issue and root cause
6. [ ] Create incident report

## Notes

- Keep this checklist updated as the deployment process evolves
- Review and update quarterly
- Store completed checklists for audit purposes

