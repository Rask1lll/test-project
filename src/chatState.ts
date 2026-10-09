import type { ChatAction, ChatState, Message, MessageStatus } from './types/chat';

export const initialChatState: ChatState = { chats: [], selectedId: null, statuses: {} };
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'select': return { ...state, selectedId: action.id, chats: state.chats.map(c => c.id === action.id ? { ...c, unread: 0 } : c) };
    case 'create': {
      const existing = state.chats.find(c => c.id === action.id);
      const chats = existing ? state.chats : [...state.chats, {
        id: action.id, phone: action.phone, name: action.name || `+${action.phone}`, messages: [], unread: 0, draft: '',
      }];
      return { ...state, selectedId: action.id, chats: chats.map(c => c.id === action.id ? { ...c, unread: 0 } : c) };
    }
    case 'draft': return { ...state, chats: state.chats.map(c => c.id === action.id ? { ...c, draft: action.text } : c) };
    case 'add': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? {
      ...c, messages: [...c.messages.filter(m => m.id !== action.message.id), action.message],
    } : c) };
    case 'sent': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? {
      ...c, messages: c.messages.filter(m => m.id !== action.serverId || m.id === action.localId).map(m => m.id === action.localId ? {
        ...m, id: action.serverId, status: state.statuses[action.serverId]?.status ?? 'sent', error: state.statuses[action.serverId]?.error,
      } : m),
    } : c) };
    case 'failed': return { ...state, chats: state.chats.map(c => c.id === action.chatId ? {
      ...c, messages: c.messages.map(m => m.id === action.id ? { ...m, status: 'failed', error: action.error } : m),
    } : c) };
    case 'notification': {
      const b = action.body;
      if (b.typeWebhook === 'outgoingMessageStatus' && b.idMessage) {
        const status: MessageStatus | undefined = ({ delivered: 'delivered', read: 'read', failed: 'failed', noAccount: 'failed', notInGroup: 'failed' } as Record<string, MessageStatus>)[b.status ?? ''];
        if (!status) return state;
        const previous = state.statuses[b.idMessage]?.status;
        // A late delivery notification must never turn a read message back into delivered.
        if (previous === 'read' && status === 'delivered') return state;
        const error = status === 'failed' ? (b.status === 'noAccount' ? 'У получателя нет аккаунта мессенджера.' : 'Мессенджер не смог доставить сообщение.') : undefined;
        return { ...state, statuses: { ...state.statuses, [b.idMessage]: { status, error } }, chats: state.chats.map(c => ({
          ...c, messages: c.messages.map(m => m.id === b.idMessage ? { ...m, status, error } : m),
        })) };
      }
      if (b.typeWebhook !== 'incomingMessageReceived') return state;
      const text = b.messageData?.typeMessage === 'textMessage' ? b.messageData.textMessageData?.textMessage
        : b.messageData?.typeMessage === 'extendedTextMessage' ? b.messageData.extendedTextMessageData?.text : undefined;
      if (text === undefined || !b.senderData?.chatId || !b.idMessage) return state;
      const sender = b.senderData;
      const phone = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : undefined;
      const existing = state.chats.find(c => c.id === sender.chatId || (sender.chatType !== 'group' && phone && c.phone === phone));
      if (existing?.messages.some(m => m.id === b.idMessage)) return state;
      const id = existing?.id ?? sender.chatId;
      const name = sender.chatName || sender.senderContactName || sender.senderName || (phone ? `+${phone}` : `Чат ${id}`);
      const message: Message = { id: b.idMessage, text, timestamp: (b.timestamp ?? Date.now() / 1000) * 1000, direction: 'incoming', status: 'read' };
      if (!existing) return { ...state, chats: [...state.chats, { id, name, phone, messages: [message], unread: 1, draft: '' }] };
      return { ...state, chats: state.chats.map(c => c.id === id ? {
        ...c, name, messages: [...c.messages, message], unread: state.selectedId === id ? 0 : c.unread + 1,
      } : c) };
    }
  }
}

export function createDemoState(): ChatState {
  const now = Date.now();
  const messages: Message[] = [
    { id: 'demo-1', text: 'Привет! Ты посмотрел маршрут на выходные?', direction: 'incoming', timestamp: now - 600000, status: 'read' },
    { id: 'demo-2', text: 'Привет! Да, всё готово 👋', direction: 'outgoing', timestamp: now - 540000, status: 'read' },
    { id: 'demo-3', text: 'Предлагаю выехать в субботу утром. До озера около двух часов, успеем вернуться до темноты.', direction: 'outgoing', timestamp: now - 530000, status: 'read' },
    { id: 'demo-4', text: 'Договорились. Я возьму термос и что-нибудь к чаю. Во сколько встречаемся?', direction: 'incoming', timestamp: now - 470000, status: 'read' },
  ];
  return { ...initialChatState, selectedId: 'demo-anna', chats: [
    { id: 'demo-anna', name: 'Анна Смирнова', phone: '79991234567', messages, unread: 0, draft: '' },
    { id: 'demo-dina', name: 'Дина', messages: [{ id: 'demo-6', text: 'Напиши адрес, я буду минут через двадцать.', direction: 'incoming', timestamp: now - 7200000, status: 'read' }], unread: 0, draft: '' },
    { id: 'demo-mikhail', name: 'Михаил', messages: [{ id: 'demo-7', text: 'Спасибо, до завтра!', direction: 'incoming', timestamp: now - 10800000, status: 'read' }], unread: 0, draft: '' },
    { id: 'demo-team', name: 'Поездка в горы', messages: [{ id: 'demo-5', text: 'Кто-нибудь знает, какая погода у озера?', direction: 'incoming', timestamp: now - 3600000, status: 'read' }], unread: 1, draft: '' },
  ] };
}
