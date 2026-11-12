-- Migration: Create MySMS Schema
-- Description: Sets up tables, RLS policies, indexes, and triggers for MySMS system.

-- 1. Profiles Table for MySMS users
CREATE TABLE IF NOT EXISTS public.mysms_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.mysms_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'mysms_profiles') THEN
        CREATE POLICY "Users can view their own profile" ON public.mysms_profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile' AND tablename = 'mysms_profiles') THEN
        CREATE POLICY "Users can insert their own profile" ON public.mysms_profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'mysms_profiles') THEN
        CREATE POLICY "Users can update their own profile" ON public.mysms_profiles FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- 2. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    installation_id TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_devices_user_installation UNIQUE (user_id, installation_id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own devices' AND tablename = 'devices') THEN
        CREATE POLICY "Users can view their own devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own devices' AND tablename = 'devices') THEN
        CREATE POLICY "Users can insert their own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own devices' AND tablename = 'devices') THEN
        CREATE POLICY "Users can update their own devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own devices' AND tablename = 'devices') THEN
        CREATE POLICY "Users can delete their own devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. SMS Messages Table
CREATE TABLE IF NOT EXISTS public.sms_messages (
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

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own messages' AND tablename = 'sms_messages') THEN
        CREATE POLICY "Users can view their own messages" ON public.sms_messages FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own messages' AND tablename = 'sms_messages') THEN
        CREATE POLICY "Users can insert their own messages" ON public.sms_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own messages' AND tablename = 'sms_messages') THEN
        CREATE POLICY "Users can delete their own messages" ON public.sms_messages FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Sync Logs Table
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    sync_status TEXT NOT NULL,
    synced_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own sync logs' AND tablename = 'sync_logs') THEN
        CREATE POLICY "Users can view their own sync logs" ON public.sync_logs FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own sync logs' AND tablename = 'sync_logs') THEN
        CREATE POLICY "Users can insert their own sync logs" ON public.sync_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_sms_messages_user_received ON public.sms_messages (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sender ON public.sms_messages (user_id, sender);
CREATE INDEX IF NOT EXISTS idx_devices_user ON public.devices (user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_created ON public.sync_logs (user_id, created_at DESC);

-- 6. Trigger for auto-profile creation
CREATE OR REPLACE FUNCTION public.handle_mysms_user_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.mysms_profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_mysms ON auth.users;
CREATE TRIGGER on_auth_user_created_mysms
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_mysms_user_created();

-- 7. Realtime setup
DO $$ BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;
    EXCEPTION WHEN duplicate_object THEN
        -- already added
    END;
END $$;
