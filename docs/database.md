# Base de datos

El bot usa PostgreSQL (Supabase). Dos tablas, sin migraciones; el repositorio no las crea automáticamente. Crea ambas en tu proyecto Supabase antes de iniciar.

## paid_users

Usuarios con suscripción premium.

```sql
CREATE TABLE paid_users (
  phone_number TEXT PRIMARY KEY,
  premium_expiry TEXT NOT NULL,
  customer_name TEXT NOT NULL
);
```

| Columna | Tipo | Null | Descripción |
|---------|------|------|-------------|
| phone_number | TEXT | No | Número WhatsApp del usuario. Clave primaria. |
| premium_expiry | TEXT | No | Fecha/hora de vencimiento premium en ISO 8601 (ej: `2025-12-31T23:59:59Z`). |
| customer_name | TEXT | No | Nombre del cliente. |

**Uso:** El repositorio en `src/infrastructure/database/repositories/user-repository.ts` consulta y actualiza esta tabla.

## premium_groups

Grupos registrados bajo un usuario premium.

```sql
CREATE TABLE premium_groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL
);
```

La columna `isActive` va entre comillas. Postgres pasa a minúsculas los nombres sin comillas, y el bot consulta `isActive`.

| Columna | Tipo | Null | Descripción |
|---------|------|------|-------------|
| group_id | TEXT | No | ID único del grupo WhatsApp. Clave primaria. |
| group_name | TEXT | No | Nombre del grupo. |
| contact_number | TEXT | No | Número del usuario propietario que registró el grupo. |
| isActive | BOOLEAN | No | `true` si el bot está activo en este grupo, `false` si desactivado. |

**Uso:** El repositorio en `src/infrastructure/database/repositories/group-repository.ts` consulta y actualiza esta tabla.

## Notas

- No hay migraciones automáticas. Crea las tablas manualmente en Supabase.
- El bot compara `premium_expiry` con la hora actual para calcular si el premium está activo.
