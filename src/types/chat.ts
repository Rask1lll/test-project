import type { NotificationBody } from './api';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface Message {
  id: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: MessageStatus;
  error?: string;
}
export interface Chat {
  id: string;
  name: string;
  phone?: string;
  messages: Message[];
  unread: number;
  draft: string;
}

export interface ChatState {
  chats: Chat[];
  selectedId: string | null;
  statuses: Record<string, { status: MessageStatus; error?: string }>;
}

export type ChatAction =
  | { type: 'select'; id: string | null }
  | { type: 'create'; id: string; phone: string; name?: string }
  | { type: 'draft'; id: string; text: string }
  | { type: 'add'; chatId: string; message: Message }
  | { type: 'sent'; chatId: string; localId: string; serverId: string }
  | { type: 'failed'; chatId: string; id: string; error: string }
  | { type: 'notification'; body: NotificationBody };

