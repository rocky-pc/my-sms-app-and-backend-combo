import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Copy, 
  Check, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Cpu, 
  Download, 
  Eye,
  Filter
} from 'lucide-react';
import { format, isToday, subDays } from 'date-fns';
import type { SmsMessage } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

interface AllMessagesProps {
  messages: SmsMessage[];
  onSelectMessage: (msg: SmsMessage) => void;
  onDeleteMessage: (id: string) => Promise<void>;
  onDeleteAllMessages: () => Promise<void>;
}

export const AllMessages: React.FC<AllMessagesProps> = ({
  messages,
  onSelectMessage,
  onDeleteMessage,
  onDeleteAllMessages,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deletion modals state
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Copy handler
  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered & Sorted messages
  const filteredMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        // Search by phone or message content
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          msg.sender.toLowerCase().includes(term) ||
          msg.message_body.toLowerCase().includes(term);

        if (!matchesSearch) return false;

        // Date range filter
        const msgDate = new Date(msg.received_at);
        if (dateFilter === 'today') {
          return isToday(msgDate);
        } else if (dateFilter === '7days') {
          return msgDate >= subDays(new Date(), 7);
        } else if (dateFilter === '30days') {
          return msgDate >= subDays(new Date(), 30);
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.received_at).getTime();
        const timeB = new Date(b.received_at).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [messages, searchTerm, dateFilter, sortOrder]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredMessages.length / itemsPerPage) || 1;
  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMessages.slice(start, start + itemsPerPage);
  }, [filteredMessages, currentPage, itemsPerPage]);

  // Export to CSV
  const handleExportCsv = () => {
    const headers = ['Sender', 'Message', 'Received At', 'SIM Slot', 'Hash'];
    const rows = filteredMessages.map((m) => [
      `"${m.sender.replace(/"/g, '""')}"`,
      `"${m.message_body.replace(/"/g, '""')}"`,
      `"${m.received_at}"`,
      `"${m.sim_slot || 'SIM 1'}"`,
      `"${m.message_hash}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MySMS_Export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJson = () => {
    const jsonContent = JSON.stringify(filteredMessages, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MySMS_Export_${format(new Date(), 'yyyy-MM-dd')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Filters, Export, Actions */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by sender phone number or message text..."
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Date Range & Sort Order */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-2" />
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Second Row: Export & Bulk Delete */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 gap-2">
          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredMessages.length}</span> messages
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              disabled={filteredMessages.length === 0}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJson}
              disabled={filteredMessages.length === 0}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 font-medium transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs text-rose-600 dark:text-rose-400 font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-44">Sender</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4 w-40">Received At</th>
                <th className="py-3 px-4 w-28">SIM</th>
                <th className="py-3 px-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedMessages.length > 0 ? (
                paginatedMessages.map((msg) => (
                  <tr
                    key={msg.id}
                    onClick={() => onSelectMessage(msg)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Sender */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        {msg.sender}
                      </span>
                    </td>

                    {/* Message Body */}
                    <td className="py-3 px-4">
                      <p className="line-clamp-2 text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                        {msg.message_body}
                      </p>
                    </td>

                    {/* Received At */}
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                      {format(new Date(msg.received_at), 'hh:mm a, dd MMM yyyy')}
                    </td>

                    {/* SIM Slot */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <Cpu className="w-3 h-3" />
                        {msg.sim_slot || 'SIM 1'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={(e) => handleCopy(msg.id, msg.message_body, e)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => onSelectMessage(msg)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setMessageToDelete(msg.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No messages match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Single Message Confirmation */}
      <ConfirmModal
        isOpen={messageToDelete !== null}
        title="Delete SMS Message"
        message="Are you sure you want to permanently delete this synchronized SMS? This action cannot be undone."
        confirmText="Delete Message"
        isDestructive={true}
        onConfirm={async () => {
          if (messageToDelete) {
            await onDeleteMessage(messageToDelete);
            setMessageToDelete(null);
          }
        }}
        onCancel={() => setMessageToDelete(null)}
      />

      {/* Delete All Messages Confirmation */}
      <ConfirmModal
        isOpen={showDeleteAllModal}
        title="Delete All Synchronized Messages"
        message={`Are you sure you want to delete all ${messages.length} messages from your Supabase cloud database? This will completely clear your message synchronization history.`}
        confirmText="Delete All"
        isDestructive={true}
        onConfirm={async () => {
          await onDeleteAllMessages();
          setShowDeleteAllModal(false);
        }}
        onCancel={() => setShowDeleteAllModal(false)}
      />
    </div>
  );
};
