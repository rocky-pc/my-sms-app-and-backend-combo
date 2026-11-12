import React, { useState } from 'react';
import { 
  MessageSquare, 
  Calendar, 
  Clock, 
  Smartphone, 
  Copy, 
  Check, 
  Radio, 
  ArrowUpRight, 
  Cpu, 
  Inbox,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isThisWeek } from 'date-fns';
import type { SmsMessage, Device, SyncLog, NavTab } from '../types';

interface DashboardProps {
  messages: SmsMessage[];
  devices: Device[];
  syncLogs: SyncLog[];
  isRealtimeConnected: boolean;
  onSelectMessage: (msg: SmsMessage) => void;
  setActiveTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  messages,
  devices,
  syncLogs,
  isRealtimeConnected,
  onSelectMessage,
  setActiveTab,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Computations
  const totalCount = messages.length;
  const todayCount = messages.filter((m) => isToday(new Date(m.received_at))).length;
  const thisWeekCount = messages.filter((m) => isThisWeek(new Date(m.received_at))).length;
  const latestMessage = messages.length > 0 ? messages[0] : null;

  // Most recent sync
  const lastSyncLog = syncLogs.length > 0 ? syncLogs[0] : null;
  const lastSyncTime = lastSyncLog
    ? formatDistanceToNow(new Date(lastSyncLog.created_at), { addSuffix: true })
    : 'No sync yet';

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SMS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Messages
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="block mt-1 text-xs text-slate-400">
              Synchronized from Android
            </span>
          </div>
        </div>

        {/* Today's Messages */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's SMS
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {todayCount}
            </span>
            <span className="block mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Received today
            </span>
          </div>
        </div>

        {/* This Week */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              This Week
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {thisWeekCount}
            </span>
            <span className="block mt-1 text-xs text-slate-400">
              Past 7 days
            </span>
          </div>
        </div>

        {/* Sync Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sync Status
            </span>
            <div className={`p-2.5 rounded-xl ${
              isRealtimeConnected 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' 
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
            }`}>
              <Radio className={`w-5 h-5 ${isRealtimeConnected ? 'animate-pulse' : ''}`} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isRealtimeConnected ? 'Realtime Live' : 'Active Polling'}
            </span>
            <span className="block mt-1 text-xs text-slate-400 truncate">
              Last sync: {lastSyncTime}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Latest Message Banner + Device Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Incoming Message Feature Card (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Latest Incoming Message
            </h2>
            <button
              onClick={() => setActiveTab('messages')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {latestMessage ? (
            <div 
              onClick={() => onSelectMessage(latestMessage)}
              className="group p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/50 transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    {latestMessage.sender}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    <Cpu className="w-3 h-3" />
                    {latestMessage.sim_slot || 'SIM 1'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">
                    {format(new Date(latestMessage.received_at), 'hh:mm a, dd MMM')}
                  </span>
                  <button
                    onClick={(e) => handleCopy(latestMessage.id, latestMessage.message_body, e)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copy message content"
                  >
                    {copiedId === latestMessage.id ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                {latestMessage.message_body}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Received {formatDistanceToNow(new Date(latestMessage.received_at), { addSuffix: true })}</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                  Click to inspect details →
                </span>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Inbox className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No incoming SMS yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Once an SMS arrives on your connected Android phone, it will automatically synchronize here in real-time.
              </p>
            </div>
          )}

          {/* Quick Stream of Recent Messages */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Message Stream
            </h3>

            {messages.slice(1, 6).map((msg) => (
              <div
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-all"
              >
                <div className="flex items-center space-x-3 truncate mr-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {msg.sender}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {msg.sim_slot || 'SIM 1'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {msg.message_body}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[11px] text-slate-400">
                    {format(new Date(msg.received_at), 'hh:mm a')}
                  </span>
                  <button
                    onClick={(e) => handleCopy(msg.id, msg.message_body, e)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Device Status & Recent Sync Logs */}
        <div className="space-y-6">
          {/* Registered Device Status */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-500" />
                Connected Phone
              </h3>
              <button
                onClick={() => setActiveTab('devices')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage
              </button>
            </div>

            {devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {device.device_name}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        Active Sync
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p className="font-mono text-[10px] truncate">
                        ID: {device.installation_id}
                      </p>
                      <p>
                        Last seen:{' '}
                        {device.last_sync_at
                          ? formatDistanceToNow(new Date(device.last_sync_at), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                No Android device registered yet. Open the Flutter app and sign in to link your smartphone.
              </div>
            )}
          </div>

          {/* Cloud Sync Logs Feed */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-500" />
                Recent Sync Logs
              </h3>
              <button
                onClick={() => setActiveTab('devices')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                All Logs
              </button>
            </div>

            {syncLogs.length > 0 ? (
              <div className="space-y-2.5">
                {syncLogs.slice(0, 4).map((log) => {
                  const isSuccess = log.sync_status === 'SUCCESS';
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {log.sync_status} ({log.synced_count} synced)
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {format(new Date(log.created_at), 'hh:mm:ss a, dd MMM')}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {log.failed_count > 0 ? `${log.failed_count} failed` : 'OK'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                No background sync events recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
