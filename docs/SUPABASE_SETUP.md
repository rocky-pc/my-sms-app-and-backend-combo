# Supabase Database & Security Architecture

This document details the PostgreSQL schema, indexes, triggers, and Row Level Security (RLS) policies implemented for **MySMS**.

---

## 1. Database Schema Overview

```
                      +-------------------+
                      |    auth.users     |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
+------------------------+             +------------------------+
|     mysms_profiles     |             |        devices         |
|------------------------|             |------------------------|
| id (PK, references     |             | id (PK, UUID)          |
|     auth.users)        |             | user_id (FK)           |
| email                  |             | device_name            |
| created_at             |             | installation_id        |
| updated_at             |             | last_sync_at           |
+------------------------+             | created_at, updated_at |
                                       +-----------+------------+
                                                   |
             +-------------------------------------+
             |
             v
+------------------------------------+         +------------------------+
|            sms_messages            |         |       sync_logs        |
|------------------------------------|         |------------------------|
| id (PK, UUID)                      |         | id (PK, UUID)          |
| user_id (FK references auth.users) |         | user_id (FK)           |
| device_id (FK references devices)  |         | device_id (FK)         |
| sender (Phone number / Alpha)      |         | sync_status            |
| message_body (Text content)        |         | synced_count           |
| received_at (TIMESTAMPTZ)          |         | failed_count           |
| sim_slot (e.g. 'SIM 1', 'SIM 2')   |         | error_message          |
| message_hash (SHA-256 Unique)      |         | created_at             |
| created_at (TIMESTAMPTZ)           |         +------------------------+
+------------------------------------+
```

---

## 2. Table Specifications

### A. `mysms_profiles`
Stores profile metadata linked 1:1 with `auth.users(id)`:
```sql
CREATE TABLE public.mysms_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### B. `devices`
Tracks registered Android smartphones:
```sql
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    installation_id TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_devices_user_installation UNIQUE (user_id, installation_id)
);
```

### C. `sms_messages`
Stores incoming SMS records. Deduplication is strictly enforced by composite unique constraint `(user_id, message_hash)`:
```sql
CREATE TABLE public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    sender TEXT NOT NULL,
    message_body TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    sim_slot TEXT,
    message_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sms_user_hash UNIQUE (user_id, message_hash)
);
```

### D. `sync_logs`
Records background sync audit events:
```sql
CREATE TABLE public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    sync_status TEXT NOT NULL, -- 'SUCCESS', 'PARTIAL', 'FAILED'
    synced_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

---

## 3. Row Level Security (RLS) Policies

All tables have RLS enabled:
```sql
ALTER TABLE public.mysms_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
```

### Policies for `sms_messages`:
- **SELECT**: `USING (auth.uid() = user_id)`
- **INSERT**: `WITH CHECK (auth.uid() = user_id)`
- **DELETE**: `USING (auth.uid() = user_id)`

This guarantees that unauthenticated requests or requests from other registered users cannot read, modify, or insert messages into your database.

---

## 4. Performance Indexes

```sql
CREATE INDEX idx_sms_messages_user_received ON public.sms_messages (user_id, received_at DESC);
CREATE INDEX idx_sms_messages_sender ON public.sms_messages (user_id, sender);
CREATE INDEX idx_devices_user ON public.devices (user_id);
CREATE INDEX idx_sync_logs_user_created ON public.sync_logs (user_id, created_at DESC);
```

---

## 5. Realtime Replication Configuration

Realtime publication enables the Web Dashboard to receive push notifications when new records arrive:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;
```
