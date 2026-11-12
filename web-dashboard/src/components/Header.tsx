import React from 'react';
import { Menu, RefreshCw, Radio, Sun, Moon } from 'lucide-react';
import type { NavTab } from '../types';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  activeTab: NavTab;
  setIsOpen: (open: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isRealtimeConnected: boolean;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'Live statistics and incoming SMS streams from your Android device',
  },
  messages: {
    title: 'All SMS Messages',
    subtitle: 'Search, filter, view and manage your synchronized personal SMS',
  },
  devices: {
    title: 'Devices & Synchronization',
    subtitle: 'Manage registered Android devices and inspect cloud sync logs',
  },
  settings: {
    title: 'System Settings',
    subtitle: 'Configure sensitive keyword masks, retention, and synchronization policies',
  },
  security: {
    title: 'Security & Row Level Security',
    subtitle: 'Verify data isolation, review encryption standards and manage account credentials',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setIsOpen,
  onRefresh,
  isRefreshing,
  isRealtimeConnected,
}) => {
  const { theme, toggleTheme } = useTheme();
  const currentTab = TAB_TITLES[activeTab];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-slate-600 dark:text-slate-300 lg:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
            {currentTab.title}
          </h1>
          <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
            {currentTab.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Realtime Live Indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <Radio className={`w-3.5 h-3.5 ${isRealtimeConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
          <span className="text-[11px] text-slate-600 dark:text-slate-300">
            {isRealtimeConnected ? 'Realtime' : 'Fallback Polling'}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle light/dark theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
