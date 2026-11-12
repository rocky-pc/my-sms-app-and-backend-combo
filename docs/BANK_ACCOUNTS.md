# Bank Accounts — SMS transaction tracking

## Supported accounts
- Indian Bank
- Airtel Payments Bank

## Processing flow
1. The Android app captures incoming SMS alerts and syncs them to `public.sms_messages`.
2. The dashboard parser recognizes supported bank names, credit/debit wording, rupee amount, reference number and explicit available-balance text.
3. Parsed records are upserted into `public.bank_transactions`, keyed by authenticated user and source SMS ID.
4. The Bank Accounts screen displays per-bank totals, latest explicitly reported balance, and a combined/filterable ledger.

## Supported sample formats
- `Rs. 350.00 debited from Airtel Payments Bank a/c Txn ID ... Bal:6481.80`
- `Airtel Payments Bank a/c is credited with Rs.350.00. Txn ID: ...`
- `Your A/c ... is credited with Rs.350.00 ... RRN ... Available balance is Rs. 351.63 - Indian Bank`
- `A/c ... debited and Rs.2000.00 added to your UPI Lite ... -Indian Bank`

UPI Lite top-ups are categorized as money debited from the bank account (a transfer out), not as a purchase.

## Setup
Apply `supabase/migrations/20261113000000_create_bank_transactions.sql` to the linked Supabase project, then deploy the web dashboard. Sign in and open **Bank Accounts**; existing synchronized messages are scanned and upserted. Re-scan SMS is available to retry parsing.

## Balance semantics and limitations
The balance shown is the latest explicit balance contained in a matching SMS alert. It is not calculated from a guessed opening balance and is not a live bank API balance. Incoming/outgoing totals cover recognized alerts only. Missing alerts, duplicate notifications with different message IDs, reversals, cash transactions and unrecognized templates can make totals incomplete. Verify all figures against the official bank statement.

## Security
The module does not request bank credentials, PINs, CVVs or OTPs. Every stored row is scoped to the signed-in Supabase user by Row Level Security. The original SMS body is retained to support audit and troubleshooting.
