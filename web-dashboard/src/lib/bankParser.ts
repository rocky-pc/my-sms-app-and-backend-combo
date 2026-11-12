import type { SmsMessage } from '../types';

export type BankKey = 'indian_bank' | 'airtel_payments_bank';
export type MoneyDirection = 'credit' | 'debit';

export interface ParsedBankTransaction {
  sms_message_id: string;
  bank_key: BankKey;
  bank_name: string;
  direction: MoneyDirection;
  amount: number;
  available_balance: number | null;
  reference_number: string | null;
  counterparty: string | null;
  transaction_at: string;
  sender: string;
  message_body: string;
  confidence: 'high' | 'medium';
}

const AMOUNT_RE = /(?:₹|INR\s*|Rs\.?\s*)([\d,]+(?:\.\d{1,2})?)/i;

function parseAmount(text: string): number | null {
  const raw = text.match(AMOUNT_RE)?.[1];
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function parseBalance(text: string): number | null {
  const patterns = [
    /(?:available\s+balance|available\s+bal(?:ance)?|\bbal)\s*(?:is|:)?\s*(?:₹|INR\s*|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/i,
    /(?:closing\s+balance|current\s+balance)\s*(?:is|:)?\s*(?:₹|INR\s*|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const raw = text.match(pattern)?.[1];
    if (raw) {
      const value = Number(raw.replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 0) return Math.round(value * 100) / 100;
    }
  }
  return null;
}

function identifyBank(sender: string, body: string): { key: BankKey; name: string } | null {
  const source = `${sender} ${body}`.toLowerCase();
  if (/airtel\s*(?:payments?\s*)?bank|airtelbank|airtelpay/i.test(source)) {
    return { key: 'airtel_payments_bank', name: 'Airtel Payments Bank' };
  }
  if (/indian\s*bank|indbank|indbnk|idibank/i.test(source)) {
    return { key: 'indian_bank', name: 'Indian Bank' };
  }
  return null;
}

export function parseBankMessage(message: SmsMessage): ParsedBankTransaction | null {
  const body = message.message_body.replace(/\s+/g, ' ').trim();
  const bank = identifyBank(message.sender, body);
  if (!bank || /\b(?:OTP|one.time.password)\b|do not share|never share/i.test(body)) return null;

  const isCredit = /credited|credit\s+to|deposited|received|added\s+to\s+(?:your\s+)?(?:a\/c|account)|refund(?:ed)?|cashback/i.test(body);
  const isDebit = /debited|debit\s+from|withdrawn|withdrawal|spent|paid|sent\s+to|\bsent\s+(?:₹|INR\s*|Rs\.?\s*)|purchase|transferred\s+from/i.test(body);
  if (isCredit === isDebit) return null;

  const amount = parseAmount(body);
  if (amount === null) return null;

  const reference = body.match(/(?:UPI\s*Ref(?:erence)?|RRN|UTR|Ref(?:erence)?\s*(?:No\.?|ID)?|Txn\s*ID)\s*[:#-]?\s*([A-Z0-9-]{6,})/i)?.[1] ?? null;
  const counterparty = body.match(/\bby\s+([A-Z][A-Za-z .'-]{1,40}?)(?:\s*\.|\s+RRN|\s+Available|$)/i)?.[1]?.trim() ?? null;

  return {
    sms_message_id: message.id,
    bank_key: bank.key,
    bank_name: bank.name,
    direction: isCredit ? 'credit' : 'debit',
    amount,
    available_balance: parseBalance(body),
    reference_number: reference,
    counterparty,
    transaction_at: message.received_at,
    sender: message.sender,
    message_body: message.message_body,
    confidence: reference ? 'high' : 'medium',
  };
}

export function parseBankMessages(messages: SmsMessage[]): ParsedBankTransaction[] {
  const seen = new Set<string>();
  return messages.flatMap((message) => {
    const transaction = parseBankMessage(message);
    if (!transaction || seen.has(transaction.sms_message_id)) return [];
    seen.add(transaction.sms_message_id);
    return [transaction];
  });
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}
