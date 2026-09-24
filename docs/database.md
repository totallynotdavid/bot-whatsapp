# Database

The bot uses PostgreSQL (Supabase). Two tables, no migrations; the repo doesn't create them automatically. Create both in your Supabase project before starting.

## paid_users

Users with premium subscription.

```sql
CREATE TABLE paid_users (
  phone_number TEXT PRIMARY KEY,
  premium_expiry TEXT NOT NULL,
  customer_name TEXT NOT NULL
);
```

| Column | Type | Null | Description |
|--------|------|------|-------------|
| phone_number | TEXT | No | User's WhatsApp number. Primary key. |
| premium_expiry | TEXT | No | Premium expiry date/time in ISO 8601 (e.g. `2025-12-31T23:59:59Z`). |
| customer_name | TEXT | No | Customer name. |

**Usage:** Repository at `src/infrastructure/database/repositories/user-repository.ts` reads and updates this table.

## premium_groups

Groups registered under a premium user.

```sql
CREATE TABLE premium_groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL
);
```

Column `isActive` must be quoted. Postgres lowercases unquoted names, and the bot queries `isActive`.

| Column | Type | Null | Description |
|--------|------|------|-------------|
| group_id | TEXT | No | Unique WhatsApp group ID. Primary key. |
| group_name | TEXT | No | Group name. |
| contact_number | TEXT | No | Number of the owner who registered the group. |
| isActive | BOOLEAN | No | `true` if bot is active in this group, `false` if disabled. |

**Usage:** Repository at `src/infrastructure/database/repositories/group-repository.ts` reads and updates this table.

## Notes

- No automatic migrations. Create tables manually in Supabase.
- Bot compares `premium_expiry` against current time to calculate if premium is active.
