import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Building2, RefreshCw, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseBankMessages, type BankKey, type ParsedBankTransaction } from '../lib/bankParser';
import type { SmsMessage } from '../types';

interface StoredTransaction extends ParsedBankTransaction {
  id: string;
  user_id: string;
  created_at: string;
}

interface Props {
  messages: SmsMessage[];
}

const ACCOUNTS: { key: BankKey; name: string; monogram: string; gradient: string }[] = [
  { key: 'indian_bank', name: 'Indian Bank', monogram: 'IB', gradient: 'from-amber-500 to-orange-600' },
  { key: 'airtel_payments_bank', name: 'Airtel Payments Bank', monogram: 'A', gradient: 'from-rose-500 to-red-600' },
];

export const BankAccounts: React.FC<Props> = ({ messages }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankKey | 'all'>('all');
  const parsed = useMemo(() => parseBankMessages(messages), [messages]);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    const { data, error: queryError } = await supabase
      .from('bank_transactions')
      .select('*')
      .order('transaction_at', { ascending: false })
      .limit(2000);
    if (queryError) throw queryError;
    setTransactions((data ?? []) as StoredTransaction[]);
  }, [user]);

  const syncParsedTransactions = useCallback(async () => {
    if (!user) return;
    if (parsed.length === 0) { setLoading(false); return; }
    setSyncing(true);
    setError('');
    try {
      const rows = parsed.map((item) => ({ user_id: user.id, ...item, parser_version: 1 }));
      const { error: upsertError } = await supabase
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'user_id,sms_message_id' });
      if (upsertError) throw upsertError;
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update bank transactions.');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [user, parsed, loadTransactions]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        await loadTransactions();
        if (!cancelled) await syncParsedTransactions();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load bank transactions.');
          setLoading(false);
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [user?.id, loadTransactions, syncParsedTransactions]);

  const filtered = useMemo(
    () => selectedBank === 'all' ? transactions : transactions.filter((tx) => tx.bank_key === selectedBank),
    [transactions, selectedBank],
  );

  const totals = useMemo(() => filtered.reduce((sum, tx) => {
    if (tx.direction === 'credit') sum.incoming += Number(tx.amount);
    else sum.outgoing += Number(tx.amount);
    return sum;
  }, { incoming: 0, outgoing: 0 }), [filtered]);

  const accountStats = useMemo(() => ACCOUNTS.map((account) => {
    const rows = transactions.filter((tx) => tx.bank_key === account.key);
    const incoming = rows.filter((tx) => tx.direction === 'credit').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const outgoing = rows.filter((tx) => tx.direction === 'debit').reduce((sum, tx) => sum + Number(tx.amount), 0);
    const latest = [...rows]
      .filter((tx) => tx.available_balance !== null && tx.available_balance !== undefined)
      .sort((a, b) => new Date(b.transaction_at).getTime() - new Date(a.transaction_at).getTime())[0];
    return { ...account, count: rows.length, incoming, outgoing, latestBalance: latest?.available_balance ?? null, balanceAt: latest?.transaction_at ?? null };
  }), [transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Personal finance</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Bank accounts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A clear view of money moving through your two accounts.</p>
        </div>
        <button onClick={() => void syncParsedTransactions()} disabled={syncing || parsed.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Updating…' : 'Re-scan SMS'}
        </button>
      </div>

      <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
        <Activity className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Balance accuracy:</strong> balance is taken from the latest bank SMS that explicitly reports it. Incoming/outgoing totals include detected alerts only; this is not a live bank connection or a substitute for your bank statement.</p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {accountStats.map((account) => (
          <section key={account.key} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className={`h-1.5 bg-gradient-to-r ${account.gradient}`} />
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${account.gradient} text-sm font-black text-white shadow-lg`}>{account.monogram}</div>
                  <div><h2 className="font-bold text-slate-950 dark:text-white">{account.name}</h2><p className="text-xs text-slate-500">{account.count} detected transactions</p></div>
                </div>
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Latest reported balance</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{account.latestBalance === null ? 'Not available' : formatINR(Number(account.latestBalance))}</p>
                <p className="mt-1 text-xs text-slate-400">{account.balanceAt ? `From SMS · ${format(new Date(account.balanceAt), 'dd MMM yyyy, hh:mm a')}` : 'Waiting for a balance alert'}</p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400"><ArrowDownLeft className="h-4 w-4" /> Money in</div>
                  <p className="mt-2 text-lg font-extrabold text-emerald-800 dark:text-emerald-300">{formatINR(account.incoming)}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/30">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400"><ArrowUpRight className="h-4 w-4" /> Money out</div>
                  <p className="mt-2 text-lg font-extrabold text-rose-800 dark:text-rose-300">{formatINR(account.outgoing)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBank(account.key)} className="mt-5 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">View transactions →</button>
            </div>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-950 dark:text-white">Transaction ledger</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} records · {formatINR(totals.incoming)} received · {formatINR(totals.outgoing)} sent/spent</p></div>
          <select value={selectedBank} onChange={(event) => setSelectedBank(event.target.value as BankKey | 'all')} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="all">All accounts</option><option value="indian_bank">Indian Bank</option><option value="airtel_payments_bank">Airtel Payments Bank</option>
          </select>
        </div>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">Loading your bank activity…</div> : filtered.length === 0 ? (
          <div className="p-12 text-center"><Wallet className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-800 dark:text-slate-100">No bank transactions found</p><p className="mt-1 text-sm text-slate-500">Matching alerts will be detected from your synchronized SMS inbox.</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60"><tr><th className="px-5 py-3">Transaction</th><th className="px-5 py-3">Bank</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Balance after alert</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((tx) => <tr key={tx.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`rounded-xl p-2.5 ${tx.direction === 'credit' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'}`}>{tx.direction === 'credit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div><p className="font-bold text-slate-800 dark:text-slate-100">{tx.direction === 'credit' ? 'Money received' : 'Money debited'}</p><p className="max-w-xs truncate text-xs text-slate-500">{tx.counterparty || tx.sender}</p></div></div></td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{tx.bank_name}</td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">{tx.reference_number || '—'}</td>
                <td className="px-5 py-4 text-xs text-slate-500">{format(new Date(tx.transaction_at), 'dd MMM yyyy, hh:mm a')}</td>
                <td className={`px-5 py-4 text-right font-extrabold tabular-nums ${tx.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.direction === 'credit' ? '+' : '−'}{formatINR(Number(tx.amount))}</td>
                <td className="px-5 py-4 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">{tx.available_balance === null ? '—' : formatINR(Number(tx.available_balance))}</td>
              </tr>)}
            </tbody>
          </table></div>
        )}
      </section>
      <p className="text-xs text-slate-400">Original SMS text is retained with each transaction for traceability. Parser confidence is heuristic; always verify against the official statement.</p>
    </div>
  );
};
