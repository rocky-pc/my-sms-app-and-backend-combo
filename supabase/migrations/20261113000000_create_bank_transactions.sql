-- SMS-derived bank transaction ledger for Indian Bank and Airtel Payments Bank.
-- No bank credentials, PINs, CVVs or OTPs are requested or stored.

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sms_message_id UUID NOT NULL REFERENCES public.sms_messages(id) ON DELETE CASCADE,
  bank_key TEXT NOT NULL CHECK (bank_key IN ('indian_bank', 'airtel_payments_bank')),
  bank_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  available_balance NUMERIC(14,2) CHECK (available_balance IS NULL OR available_balance >= 0),
  reference_number TEXT,
  counterparty TEXT,
  transaction_at TIMESTAMPTZ NOT NULL,
  sender TEXT NOT NULL,
  message_body TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium')),
  parser_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_bank_transactions_user_sms UNIQUE (user_id, sms_message_id)
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can view their own bank transactions" ON public.bank_transactions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can insert their own bank transactions" ON public.bank_transactions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can update their own bank transactions" ON public.bank_transactions
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own bank transactions" ON public.bank_transactions;
CREATE POLICY "Users can delete their own bank transactions" ON public.bank_transactions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_sms_message_id
  ON public.bank_transactions (sms_message_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_date
  ON public.bank_transactions (user_id, transaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_bank_date
  ON public.bank_transactions (user_id, bank_key, transaction_at DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
