-- Enable Row-Level Security on key tables and add policies keyed to app.current_user_id

-- Users table: self-access only
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users
  FOR SELECT
  USING (id = current_setting('app.current_user_id', true));
CREATE POLICY users_update ON users
  FOR UPDATE
  USING (id = current_setting('app.current_user_id', true))
  WITH CHECK (id = current_setting('app.current_user_id', true));

-- Wallets: owner-only access
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets FORCE ROW LEVEL SECURITY;
CREATE POLICY wallets_select ON wallets
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY wallets_modify ON wallets
  FOR INSERT TO public
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
CREATE POLICY wallets_update ON wallets
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Transactions: via wallet owner
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY transactions_select ON transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallets w
      WHERE w.id = transactions.wallet_id
        AND w.user_id = current_setting('app.current_user_id', true)
    )
  );

-- Notifications: owner-only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON notifications
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

-- Sessions: owner-only
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_select ON sessions
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

-- Idempotency keys: allow by user_id when set, otherwise block
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY idempotency_select ON idempotency_keys
  FOR SELECT
  USING (user_id IS NOT NULL AND user_id = current_setting('app.current_user_id', true));

-- Safety: default deny when app.current_user_id is not set (current_setting(..., true) returns NULL)
-- Policies above evaluate to false when NULL, effectively denying access.
