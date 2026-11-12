import React, { useState } from 'react';
import { MessageSquare, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let loginEmail = email.trim();
      if (loginEmail.toLowerCase() === 'demo') {
        loginEmail = 'demo@mysms.app';
      }
      const { error } = await signIn(loginEmail, password);
      if (error) throw error;
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            MySMS Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Private personal SMS synchronization system
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Sign In to Your Dashboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Authorized personal access only.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo or you@domain.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Strictly private. Protected with Supabase Row Level Security.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
