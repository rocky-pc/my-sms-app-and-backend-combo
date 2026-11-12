import React from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Smartphone, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  Sun, 
  Moon, 
  Radio
} from 'lucide-react';
import type { NavTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  unreadCount?: number;
  isRealtimeConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  unreadCount = 0,
  isRealtimeConnected,
}) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'messages' as NavTab, label: 'All Messages', icon: MessageSquare, badge: unreadCount },
    { id: 'devices' as NavTab, label: 'Devices & Sync', icon: Smartphone },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
    { id: 'security' as NavTab, label: 'Security & RLS', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                MySMS
              </span>
              <span className="block text-[10px] uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400">
                Personal Sync
              </span>
            </div>
          </div>
        </div>

        {/* Realtime Status Indicator in Sidebar */}
        <div className="px-4 py-3 mx-4 my-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Radio className={`w-3.5 h-3.5 ${isRealtimeConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              Realtime
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isRealtimeConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {isRealtimeConnected ? 'Connected' : 'Polling'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer & User info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="truncate max-w-[110px]">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.email || 'User'}
                </p>
                <p className="text-[10px] text-slate-500">Personal Sim</p>
              </div>
            </div>
            
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => signOut()}
            className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
