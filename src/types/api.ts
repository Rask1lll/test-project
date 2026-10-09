export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
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

export type ConnectionStatus = 'connected' | 'reconnecting' | 'stopped';

export interface InstanceStateResponse { stateInstance: string }
export interface InstanceSettingsResponse {
  webhookUrl?: string;
  incomingWebhook?: string;
  outgoingWebhook?: string;
  typeInstance?: string;
}
export interface CheckAccountResponse { exist?: boolean; chatId?: string; status?: boolean }
export interface SendMessageResponse { idMessage: string }
export interface DeleteNotificationResponse { result: boolean }
export interface ConnectionResult { statusesEnabled: boolean }

export interface ApiRequestOptions {
  body?: unknown;
  suffix?: string;
  query?: string;
  signal?: AbortSignal;
  timeout?: number;
}
export interface GreenApi {
  connect(signal?: AbortSignal): Promise<ConnectionResult>;
  checkAccount(phone: string, signal?: AbortSignal): Promise<string>;
  sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<string>;
  receiveNotification(signal: AbortSignal): Promise<QueueNotification | null>;
  deleteNotification(receiptId: number, signal: AbortSignal): Promise<void>;
}
export interface PollingCallbacks {
  onNotification: (body: NotificationBody) => void | 'stop';
  onStatus: (status: ConnectionStatus, error?: string) => void;
}
