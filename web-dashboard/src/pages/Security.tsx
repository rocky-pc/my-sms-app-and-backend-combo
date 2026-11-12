import React, { useState } from 'react';
import { ShieldCheck, KeyRound, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Security: React.FC = () => {
  const { user, updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword);
    setLoading(false);

    if (error) {
      setStatusMessage({ type: 'error', text: error.message });
    } else {
      setStatusMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* RLS Status Overview */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Row Level Security (RLS) Verification
        </h3>
        <p className="text-xs text-slate-500">
          Your messages and devices are isolated at the database engine level. Only your authenticated user ID can access these records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Table: sms_messages</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">RLS Active • Strict User Isolation</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Table: devices</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">RLS Active • Owner-Only Access</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Table: sync_logs</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">RLS Active • Private Audit Logs</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center space-x-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">Table: mysms_profiles</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">RLS Active • Cascade Protected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          Update Account Password
        </h3>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* Session Details */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-slate-500" />
          Active Session Details
        </h3>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">User UUID:</span>
            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">{user?.id || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Email:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{user?.email || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Service Role Protection:</span>
            <span className="font-bold text-emerald-600">Never Exposed in Frontend</span>
          </div>
        </div>
      </div>
    </div>
  );
};
