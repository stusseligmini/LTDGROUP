# Database Setup & Migration Guide

## Overview

Celora uses **Prisma ORM** with **PostgreSQL** and **PgBouncer** for connection pooling.

## Prerequisites

- PostgreSQL 14+ running
- PgBouncer configured (optional for development)
- Node.js 20+

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install `@prisma/client` and `prisma` CLI.

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
# For local development (direct connection)
DATABASE_URL="postgresql://postgres:password@localhost:5432/celora_dev"
DIRECT_DATABASE_URL="postgresql://postgres:password@localhost:5432/celora_dev"

# For production (with PgBouncer)
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/celora_db?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://user:pass@postgres:5432/celora_db"
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

This reads `prisma/schema.prisma` and generates TypeScript types.

### 4. Run Migrations

#### Development (creates migration files)
```bash
npm run db:migrate
```

You'll be prompted to name the migration (e.g., "init", "add-wallets").

#### Production (applies existing migrations)
```bash
npm run db:migrate:deploy
```

### 5. Seed Database (Optional)

Populate with test data:

```bash
npm run db:seed
```

Creates:
- 2 test users (alice@celora.io, bob@celora.io)
- 4 wallets (Celo, Ethereum, Bitcoin, Solana)
- Sample transactions
- Sample notifications

## Database Schema

### Core Models

1. **User** - Firebase Auth user accounts
2. **Session** - Firebase session / token metadata
3. **Wallet** - Multi-chain wallet support
4. **Transaction** - Blockchain transaction history
5. **Notification** - Push/email/in-app notifications
6. **IdempotencyKey** - API request deduplication
7. **RateLimit** - Rate limiting state

### Relationships

```
User (1) ──> (N) Wallet
User (1) ──> (N) Notification
User (1) ──> (N) Session
Wallet (1) ──> (N) Transaction
```

## PgBouncer Configuration

### Why PgBouncer?

- **Connection pooling**: Reduces PostgreSQL connection overhead
- **Scalability**: Supports 1000s of client connections
- **Works with managed PostgreSQL offerings**: Neon, RDS, Cloud SQL, etc.

### Configuration (`pgbouncer.ini`)

```ini
[databases]
celora_db = host=postgres-server port=5432 dbname=celora_db

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Connection pooling
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5

# Timeouts
server_idle_timeout = 600
server_lifetime = 3600
```

### Transaction Pool Mode

- **Best for Prisma**: Each query runs in separate transaction
- **No session state**: Cannot use temp tables or prepared statements
- **High throughput**: Connections released immediately after query

## Prisma Client Usage

### Basic Queries

```typescript
import { prisma } from '@/server/db/client';

// Create user
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    displayName: 'John Doe',
  },
});

// Find wallets
const wallets = await prisma.wallet.findMany({
  where: { userId: user.id },
  include: { transactions: true },
});

// Update notification
await prisma.notification.update({
  where: { id: notificationId },
  data: { status: 'read', readAt: new Date() },
});
```

### With Retry Logic

```typescript
import { withRetry } from '@/server/db/client';

const result = await withRetry(async () => {
  return await prisma.wallet.create({ data: { ... } });
});
```

Automatically retries on transient failures (3 attempts, exponential backoff).

### Health Check

```typescript
import { checkDatabaseHealth } from '@/server/db/client';

const health = await checkDatabaseHealth();
// { status: 'healthy', latency: 15 }
```

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma Client from schema |
| `npm run db:push` | Push schema changes (dev only) |
| `npm run db:migrate` | Create and apply migration (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed` | Populate database with test data |
| `npm run db:studio` | Open Prisma Studio (GUI) |
| `npm run db:reset` | Reset database (WARNING: deletes all data) |

## Migration Workflow

### Development

1. Modify `prisma/schema.prisma`
2. Run `npm run db:migrate` → creates `prisma/migrations/YYYYMMDDHHMMSS_name/`
3. Migration applied automatically
4. Commit migration files to Git

### Production

1. Migrations run via CI/CD pipeline
2. Uses `npm run db:migrate:deploy`
3. Migrations applied before app deployment
4. Zero-downtime: use additive migrations first

## Troubleshooting

### Error: "Can't reach database server"

- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running: `pg_isready`
- Check firewall/network rules

### Error: "P2021: Table does not exist"

- Run migrations: `npm run db:migrate`
- Or reset: `npm run db:reset` (dev only)

### Error: "Too many connections"

- Check PgBouncer is running
- Increase `max_client_conn` in `pgbouncer.ini`
- Verify app uses `DATABASE_URL` (pooled), not `DIRECT_DATABASE_URL`

### Slow Queries

- Run `npm run db:studio` and check indexes
- Enable query logging: `PRISMA_LOG_QUERIES=true`
- Use `EXPLAIN ANALYZE` in PostgreSQL

## Security Best Practices

1. **Never commit `.env`** - use `.env.example` as template
2. **Use SSL in production**: `?sslmode=require`
3. **Rotate credentials** regularly via a secret manager (e.g., AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault)
4. **Encrypt sensitive data**: Use dedicated encrypted fields
5. **Audit logs**: Track all DB changes via triggers or CDC

## Next Steps

- [ ] Set up automated backups (pg_dump / managed provider automated backups)
- [ ] Configure read replicas for scaling (if provider supports)
- [ ] Implement CDC for real-time event streaming
- [ ] Add monitoring dashboards (e.g., Grafana + Prometheus / provider metrics)
