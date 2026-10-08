# Database

The bot stores its data in PostgreSQL through Supabase. It uses two tables and
creates neither. [`sql/schema.sql`](../sql/schema.sql) holds both definitions.
Run it in the Supabase SQL editor, or with `psql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/whatsapp-bot/sql/schema.sql
```

## paid_users

Users with a premium subscription.

| Column           | Type          | Description                                                 |
| ---------------- | ------------- | ----------------------------------------------------------- |
| `phone_number`   | `TEXT`        | The user's WhatsApp number. Primary key.                    |
| `premium_expiry` | `TIMESTAMPTZ` | When premium ends.                                          |
| `customer_name`  | `TEXT`        | A display name. `/addpremium` sets it to `Usuario Premium`. |

A user is Premium while `premium_expiry` is later than the current time.
`/addpremium` writes the row. The repository is
`src/infrastructure/database/repositories/user-repository.ts`.

## premium_groups

Groups registered by a premium user.

| Column           | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| `group_id`       | `TEXT`    | The WhatsApp group ID. Primary key.              |
| `group_name`     | `TEXT`    | The group's name.                                |
| `contact_number` | `TEXT`    | The number of the user who registered the group. |
| `"isActive"`     | `BOOLEAN` | `true` while the bot answers in the group.       |

The column name `isActive` is quoted in the SQL, because Postgres lowercases
unquoted names and the bot queries `isActive`. `/addgroup` and `/bot` write the
rows. The repository is
`src/infrastructure/database/repositories/group-repository.ts`.

## Upgrade an existing database

[`sql/migrations/`](../sql/migrations/) holds one script per schema change.
Apply them in order to a database created before the change.

- `001-premium-expiry-timestamptz.sql` changes `paid_users.premium_expiry` from
  `TEXT` to `TIMESTAMPTZ`. Values with an offset keep it. Values without one are
  read as UTC.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f apps/whatsapp-bot/sql/migrations/001-premium-expiry-timestamptz.sql
```
