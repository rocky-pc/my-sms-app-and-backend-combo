export interface SmsMessage {
  id: string;
  user_id: string;
  device_id: string | null;
  sender: string;
  message_body: string;
  received_at: string;
  sim_slot: string | null;
  message_hash: string;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  installation_id: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  user_id: string;
  device_id: string | null;
  sync_status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  synced_count: number;
  failed_count: number;
  error_message?: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export type NavTab = 'dashboard' | 'messages' | 'bank-accounts' | 'devices' | 'settings' | 'security';
