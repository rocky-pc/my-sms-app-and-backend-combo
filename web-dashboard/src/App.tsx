import React, { useState, useEffect, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MessageDetailsModal } from './components/MessageDetailsModal';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AllMessages } from './pages/AllMessages';
import { Devices } from './pages/Devices';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { BankAccounts } from './pages/BankAccounts';
import type { SmsMessage, Device, SyncLog, NavTab } from './types';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core Data States
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Loading & Network States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SmsMessage | null>(null);

  // Fetch all initial data
  const loadData = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);

    try {
      // 1. Fetch SMS Messages
      const { data: msgData, error: msgError } = await supabase
        .from('sms_messages')
        .select('*')
        .order('received_at', { ascending: false });

      if (!msgError && msgData) {
        setMessages(msgData as SmsMessage[]);
      }

      // 2. Fetch Devices
      const { data: devData, error: devError } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!devError && devData) {
        setDevices(devData as Device[]);
      }

      // 3. Fetch Sync Logs
      const { data: logData, error: logError } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!logError && logData) {
        setSyncLogs(logData as SyncLog[]);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setMessages([]);
      setDevices([]);
      setSyncLogs([]);
    }
  }, [user, loadData]);

  // Supabase Realtime Subscription + Polling Fallback
  useEffect(() => {
    if (!user) return;

    let channel: RealtimeChannel | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      channel = supabase
        .channel(`mysms_realtime_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sms_messages' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as SmsMessage;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [newMsg, ...prev];
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new as SmsMessage;
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              );
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'devices' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const dev = payload.new as Device;
              setDevices((prev) => {
                const filtered = prev.filter((d) => d.id !== dev.id);
                return [dev, ...filtered];
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'sync_logs' },
          (payload) => {
            const newLog = payload.new as SyncLog;
            setSyncLogs((prev) => [newLog, ...prev.slice(0, 29)]);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsRealtimeConnected(false);
          }
        });
    } catch (e) {
      console.warn('Realtime subscription error, fallback polling active', e);
      setIsRealtimeConnected(false);
    }

    // Always maintain a 20-second fallback polling interval in case websocket connection drops
    fallbackInterval = setInterval(() => {
      loadData();
    }, 20000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [user, loadData]);

  // Actions: Delete Single Message
  const handleDeleteMessage = async (id: string) => {
    try {
      const { error } = await supabase.from('sms_messages').delete().eq('id', id);
      if (!error) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        alert('Failed to delete message: ' + error.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Actions: Delete All Messages
  const handleDeleteAllMessages = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('sms_messages')
        .delete()
        .eq('user_id', user.id);

      if (!error) {
        setMessages([]);
      } else {
        alert('Failed to delete messages: ' + error.message);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Initializing MySMS Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        unreadCount={messages.length}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          setIsOpen={setSidebarOpen}
          onRefresh={loadData}
          isRefreshing={isRefreshing}
          isRealtimeConnected={isRealtimeConnected}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              messages={messages}
              devices={devices}
              syncLogs={syncLogs}
              isRealtimeConnected={isRealtimeConnected}
              onSelectMessage={setSelectedMessage}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'messages' && (
            <AllMessages
              messages={messages}
              onSelectMessage={setSelectedMessage}
              onDeleteMessage={handleDeleteMessage}
              onDeleteAllMessages={handleDeleteAllMessages}
            />
          )}

          {activeTab === 'bank-accounts' && <BankAccounts messages={messages} />}

          {activeTab === 'devices' && (
            <Devices
              devices={devices}
              syncLogs={syncLogs}
              onRefresh={loadData}
              isRefreshing={isRefreshing}
            />
          )}

          {activeTab === 'settings' && <Settings />}

          {activeTab === 'security' && <Security />}
        </main>
      </div>

      {/* Message Details Modal */}
      <MessageDetailsModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onDelete={handleDeleteMessage}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
