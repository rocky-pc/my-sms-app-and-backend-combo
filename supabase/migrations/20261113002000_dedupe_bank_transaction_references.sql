-- Remove duplicate SMS notifications for the same bank transaction reference.
-- Keep the newest alert for each user, bank and reference number.
DELETE FROM public.bank_transactions older
USING public.bank_transactions newer
WHERE older.user_id = newer.user_id
  AND older.bank_key = newer.bank_key
  AND older.reference_number IS NOT NULL
  AND older.reference_number = newer.reference_number
  AND (
    older.transaction_at < newer.transaction_at
    OR (older.transaction_at = newer.transaction_at AND older.id < newer.id)
  );

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT uq_bank_transactions_user_bank_reference
  UNIQUE (user_id, bank_key, reference_number);
