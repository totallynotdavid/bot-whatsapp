CREATE TABLE paid_users (
  phone_number TEXT PRIMARY KEY,
  premium_expiry TIMESTAMPTZ NOT NULL,
  customer_name TEXT NOT NULL
);

CREATE TABLE premium_groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL
);
