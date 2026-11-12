import React from 'react';
import { Settings as SettingsIcon, Shield, Database, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Account Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
          Account & System Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-slate-500">Authenticated Email:</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
              {user?.email || 'Unknown'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-slate-500">System Mode:</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
              Strictly Personal Use
            </p>
          </div>
        </div>
      </div>

      {/* Sensitive SMS Policy */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          Sensitive SMS & OTP Protection Guidelines
        </h3>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Important Security Considerations</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Synchronizing SMS messages to a cloud database provides accessibility across all your devices, but storing sensitive two-factor authentication (2FA) verification codes and financial alerts in the cloud requires vigilance.
          </p>
        </div>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start space-x-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong className="text-slate-800 dark:text-slate-100">Client-Side Masking:</strong> The Flutter mobile app includes a toggle to mask 4-8 digit numeric verification codes before uploading to the database.
            </p>
          </div>

          <div className="flex items-start space-x-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong className="text-slate-800 dark:text-slate-100">Realistic Limitations:</strong> Keyword filtering detects common patterns like "OTP", "code", or "pin", but financial institutions frequently change SMS layouts. Therefore, complete automated detection across all formats cannot be mathematically guaranteed.
            </p>
          </div>

          <div className="flex items-start space-x-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <p>
              <strong className="text-slate-800 dark:text-slate-100">User Control:</strong> You can delete any message at any time individually, or use the "Delete All" feature to wipe all synchronized history from the database with one click.
            </p>
          </div>
        </div>
      </div>

      {/* Retention Policy */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-600" />
          Data Retention & Archival
        </h3>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p>
            Because this application captures personal SMS messages, we recommend regularly exporting your data and deleting older records that are no longer needed:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-500">
            <li>Use the <strong>CSV / JSON Export</strong> feature on the Messages page for local offline backups.</li>
            <li>Messages can be purged whenever you wish using the <strong>Delete All</strong> button.</li>
            <li>All messages in the database are protected with PostgreSQL Row Level Security (RLS) linked directly to your user ID.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
