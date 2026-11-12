-- Cover the SMS-message foreign key for efficient deletes and joins.
CREATE INDEX IF NOT EXISTS idx_bank_transactions_sms_message_id
  ON public.bank_transactions (sms_message_id);
