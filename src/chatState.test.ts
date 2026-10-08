import { describe, expect, it } from 'vitest';
import { chatReducer, initialChatState } from './chatState';
import type { NotificationBody } from './types';

const incoming: NotificationBody = {
  typeWebhook: 'incomingMessageReceived', timestamp: 1763115112, idMessage: 'incoming-1',
  senderData: { chatId: '10000000', chatName: 'Анна', senderPhoneNumber: 79991234567 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
};
const room = () => chatReducer(initialChatState, { type: 'create', id: '10000000', phone: '79991234567' });

describe('chat notification processing', () => {
  it('routes incoming replies to the selected Telegram chat and deduplicates redeliveries', () => {
    let state = chatReducer(room(), { type: 'notification', body: incoming });
    state = chatReducer(state, { type: 'notification', body: incoming });
    expect(state.chats).toHaveLength(1);
    expect(state.chats[0]).toMatchObject({ name: 'Анна', unread: 0 });
    expect(state.chats[0].messages).toHaveLength(1);
  });
  it('creates unknown conversations and tracks unread counts only for other chats', () => {
    const state = chatReducer(initialChatState, { type: 'notification', body: incoming });
    expect(state.chats[0].unread).toBe(1);
    expect(chatReducer(state, { type: 'select', id: '10000000' }).chats[0].unread).toBe(0);
  });
  it('handles text with links and ignores media', () => {
    const state = chatReducer(room(), { type: 'notification', body: { ...incoming, messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://example.org' } } } });
    expect(state.chats[0].messages[0].text).toBe('https://example.org');
    expect(chatReducer(state, { type: 'notification', body: { ...incoming, idMessage: 'image', messageData: { typeMessage: 'imageMessage' } } })).toBe(state);
  });
  it('preserves a status notification that arrives before sendMessage completes', () => {
    let state = chatReducer(room(), { type: 'add', chatId: '10000000', message: { id: 'local-1', text: 'Привет', timestamp: 1, direction: 'outgoing', status: 'sending' } });
    state = chatReducer(state, { type: 'notification', body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'server-1', status: 'read' } });
    state = chatReducer(state, { type: 'sent', chatId: '10000000', localId: 'local-1', serverId: 'server-1' });
    state = chatReducer(state, { type: 'notification', body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'server-1', status: 'delivered' } });
    expect(state.chats[0].messages[0]).toMatchObject({ id: 'server-1', status: 'read' });
  });
  it('renders Telegram delivery failures instead of leaving a success indicator', () => {
    let state = chatReducer(room(), { type: 'add', chatId: '10000000', message: { id: 'server-1', text: 'test', timestamp: 1, direction: 'outgoing', status: 'sent' } });
    state = chatReducer(state, { type: 'notification', body: { typeWebhook: 'outgoingMessageStatus', idMessage: 'server-1', status: 'noAccount' } });
    expect(state.chats[0].messages[0]).toMatchObject({ status: 'failed', error: 'У получателя нет аккаунта мессенджера.' });
  });
});
