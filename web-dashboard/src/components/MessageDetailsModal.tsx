import React, { useState } from 'react';
import { X, Copy, Check, Trash2, Calendar, Phone, Cpu, Hash, Code } from 'lucide-react';
import { format } from 'date-fns';
import type { SmsMessage } from '../types';

interface MessageDetailsModalProps {
  message: SmsMessage | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const MessageDetailsModal: React.FC<MessageDetailsModalProps> = ({
  message,
  onClose,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  if (!message) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.message_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const receivedDate = new Date(message.received_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Phone className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {message.sender}
              </h3>
              <p className="text-xs text-slate-500">
                {message.sim_slot || 'SIM 1'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center text-xs text-slate-500 mb-1">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Received At
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {format(receivedDate, 'PPpp')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center text-xs text-slate-500 mb-1">
                <Cpu className="w-3.5 h-3.5 mr-1" />
                SIM Slot
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {message.sim_slot || 'SIM 1 (Default)'}
              </p>
            </div>
          </div>

          {/* SMS Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Message Content
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap select-text leading-relaxed font-sans">
              {message.message_body}
            </div>
          </div>

          {/* Technical Hash */}
          <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium">
                <Hash className="w-3.5 h-3.5" /> Deduplication Hash (SHA-256)
              </span>
            </div>
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all select-all">
              {message.message_hash}
            </p>
          </div>

          {/* Raw JSON toggle */}
          <div>
            <button
              onClick={() => setShowJson(!showJson)}
              className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showJson ? 'Hide Raw JSON' : 'View Raw Database Record'}</span>
            </button>
            {showJson && (
              <pre className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(message, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            onClick={() => {
              if (window.confirm('Delete this message permanently?')) {
                onDelete(message.id);
                onClose();
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Message</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
