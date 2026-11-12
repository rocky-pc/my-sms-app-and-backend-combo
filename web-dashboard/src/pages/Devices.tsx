import React from 'react';
import { Smartphone, Activity, CheckCircle2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Device, SyncLog } from '../types';

interface DevicesProps {
  devices: Device[];
  syncLogs: SyncLog[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Devices: React.FC<DevicesProps> = ({
  devices,
  syncLogs,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="space-y-6">
      {/* Registered Devices Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              Registered Devices ({devices.length})
            </h2>
            <p className="text-xs text-slate-500">
              Android smartphones authorized to synchronize incoming SMS
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {devices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => {
              const lastSync = device.last_sync_at
                ? formatDistanceToNow(new Date(device.last_sync_at), { addSuffix: true })
                : 'Never';

              return (
                <div
                  key={device.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {device.device_name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last synced {lastSync}
                        </p>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      Connected
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Installation ID:</span>
                      <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                        {device.installation_id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Registered On:</span>
                      <span>{format(new Date(device.created_at), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No devices registered yet. Install and launch the MySMS Flutter app on your phone to link it.
          </div>
        )}
      </div>

      {/* Cloud Sync Logs Section */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Synchronization Logs
          </h2>
          <p className="text-xs text-slate-500">
            Audit trail of background sync events reported by the Android WorkManager
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Synced Messages</th>
                  <th className="py-3 px-4">Failed</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {syncLogs.length > 0 ? (
                  syncLogs.map((log) => {
                    const isSuccess = log.sync_status === 'SUCCESS';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isSuccess
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            {log.sync_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {log.synced_count}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {log.failed_count}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {format(new Date(log.created_at), 'hh:mm:ss a, dd MMM yyyy')}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No synchronization events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
