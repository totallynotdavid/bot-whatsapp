-- Converts paid_users.premium_expiry from TEXT (ISO 8601 strings) to
-- TIMESTAMPTZ. Values with an offset keep it. Values without one are read as UTC.
BEGIN;
SET LOCAL timezone = 'UTC';
ALTER TABLE paid_users
  ALTER COLUMN premium_expiry TYPE TIMESTAMPTZ
  USING premium_expiry::TIMESTAMPTZ;
COMMIT;
