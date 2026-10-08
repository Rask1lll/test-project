export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

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

// Optional fields allow service events and unsupported media to pass through the queue.
export interface NotificationBody {
  typeWebhook: string;
  timestamp?: number;
  idMessage?: string;
  chatId?: string;
  status?: string;
  description?: string;
  stateInstance?: string;
  senderData?: {
    chatId: string;
    chatName?: string;
    senderName?: string;
    senderContactName?: string;
    senderPhoneNumber?: number;
    chatType?: string;
  };
  messageData?: {
    typeMessage: string;
    textMessageData?: { textMessage: string };
    extendedTextMessageData?: { text: string };
  };
}
export interface QueueNotification { receiptId: number; body: NotificationBody }
