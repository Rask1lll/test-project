import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowLeft, Check, CheckCheck, ChevronRight, CircleHelp, LogOut, MessageCircle, Plus, Search, Send, ShieldCheck, X } from 'lucide-react';
import { createGreenApi, instanceStateMessage } from '../api/greenApi';
import { delay, pollNotifications } from '../api/polling';
import { chatReducer, createDemoState, initialChatState } from '../chatState';
import type { Credentials, Message } from '../types';
import Brand from './Brand';
import { useMobileViewportHeight } from '../useMobileViewportHeight';
import NewChatDialog from './NewChatDialog';

export type Session = { mode: 'demo' } | { mode: 'live'; credentials: Credentials; statusesEnabled: boolean };
const time = (value: number) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(value);
const date = (value: number) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(value);
function dateLabel(value: number) {
  const day = new Date(value).toDateString();
  if (day === new Date().toDateString()) return 'Сегодня';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  return day === yesterday.toDateString() ? 'Вчера' : date(value);
}
function initials(name: string) {
  return name.startsWith('+') ? name.slice(-2) : name.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function Avatar({ name, index = 0, small = false }: { name: string; index?: number; small?: boolean }) {
  return <div className={`avatar avatar-${index % 4} ${small ? 'small' : ''}`} aria-hidden="true">{initials(name)}</div>;
}

export default function ChatWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const demo = session.mode === 'demo';
  const viewportHeight = useMobileViewportHeight();
  const name = 'Telegram';
  const [state, dispatch] = useReducer(chatReducer, undefined, () => demo ? createDemoState() : initialChatState);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [connection, setConnection] = useState<'connected' | 'reconnecting' | 'stopped'>('connected');
  const [connectionError, setConnectionError] = useState('');
  const [retryEpoch, setRetryEpoch] = useState(0);
  const [sending, setSending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const sessionAbort = useRef<AbortController | null>(null);
  const sendLock = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const api = useMemo(() => session.mode === 'live' ? createGreenApi(session.credentials) : null, [session]);
  const selected = state.chats.find(c => c.id === state.selectedId);
  const sortedChats = [...state.chats].sort((a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0));
  const filteredChats = sortedChats.filter(c => `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(query.toLowerCase().trim()));

  useEffect(() => {
    const controller = new AbortController();
    sessionAbort.current = controller;
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (api) {
      const run = async () => {
        if (retryEpoch) {
          setConnection('reconnecting');
          try { await api.connect(controller.signal); }
          catch (error) {
            if (!controller.signal.aborted) { setConnection('stopped'); setConnectionError((error as Error).message); }
            return;
          }
        }
        await pollNotifications(api, controller.signal, {
          onNotification: body => {
            if (body.typeWebhook === 'stateInstanceChanged' && body.stateInstance && body.stateInstance !== 'authorized') {
              setConnection('stopped'); setConnectionError(instanceStateMessage(body.stateInstance));
              return 'stop';
            }
            dispatch({ type: 'notification', body });
          },
          onStatus: (status, error) => { setConnection(status); setConnectionError(error ?? ''); },
        });
      };
      void run();
    }
    return () => controller.abort();
  }, [api, retryEpoch]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' }); }, [selected?.id, selected?.messages, typing]);
  useEffect(() => {
    if (document.activeElement === textarea.current) bottom.current?.scrollIntoView({ block: 'end' });
  }, [viewportHeight]);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = 'auto';
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 140)}px`;
    }
  }, [selected?.draft, selected?.id]);

  async function createChat(phone: string, signal: AbortSignal) {
    const existing = state.chats.find(c => c.phone === phone);
    if (existing) { dispatch({ type: 'select', id: existing.id }); return; }
    const combined = sessionAbort.current ? AbortSignal.any([signal, sessionAbort.current.signal]) : signal;
    const id = api ? await api.checkAccount(phone, combined) : `demo-${phone}`;
    if (!combined.aborted) dispatch({ type: 'create', id, phone });
  }

  async function send(previous?: Message) {
    if (!selected || sendLock.current || connection !== 'connected') return;
    const text = previous?.text ?? selected.draft;
    if (!text.trim() || text.length > 4000) return;
    const chatId = selected.id;
    const signal = sessionAbort.current!.signal;
    const localId = previous?.id ?? `local-${crypto.randomUUID()}`;
    sendLock.current = true; setSending(true);
    dispatch({ type: 'add', chatId, message: { id: localId, text, direction: 'outgoing', timestamp: previous?.timestamp ?? Date.now(), status: 'sending' } });
    if (!previous) dispatch({ type: 'draft', id: chatId, text: '' });
    try {
      const serverId = api ? await api.sendMessage(chatId, text, signal) : `demo-${crypto.randomUUID()}`;
      if (signal.aborted) return;
      dispatch({ type: 'sent', chatId, localId, serverId });
      if (demo) {
        dispatch({ type: 'notification', body: { typeWebhook: 'outgoingMessageStatus', idMessage: serverId, status: 'read' } });
        setTyping(chatId);
        void delay(1100, signal).then(() => {
          if (signal.aborted) return;
          dispatch({ type: 'notification', body: {
            typeWebhook: 'incomingMessageReceived', idMessage: `demo-${crypto.randomUUID()}`, timestamp: Date.now() / 1000,
            senderData: { chatId, chatName: selected.name },
            messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: `Сообщение получено! Это демо-ответ. Подключите GREEN-API, чтобы общаться в ${name} 💬` } },
          } });
          setTyping(null);
        }).catch(() => {});
      }
    } catch (error) {
      if (!signal.aborted) dispatch({ type: 'failed', chatId, id: localId, error: (error as Error).message });
    } finally {
      sendLock.current = false;
      if (!signal.aborted) { setSending(false); textarea.current?.focus(); }
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return <main className={`workspace ${selected ? 'has-selection' : ''} ${helpOpen ? 'help-open' : ''}`} style={viewportHeight ? { '--mobile-height': `${viewportHeight}px` } as CSSProperties : undefined}>
    <aside className="sidebar" aria-label="Список чатов">
      <div className="workspace-top"><Brand /><nav aria-label="Приложение"><button className="icon-button" onClick={() => setHelpOpen(!helpOpen)} aria-label="Помощь" aria-expanded={helpOpen}><CircleHelp size={20} /></button><button className="icon-button" onClick={onLogout} aria-label="Выйти" title="Выйти"><LogOut size={20} /></button></nav></div>
      <header className="sidebar-header"><h1>Чаты <span>{state.chats.length}</span></h1><button className="icon-button new-chat-button" aria-label="Новый чат" title="Новый чат" onClick={() => setNewChatOpen(true)}><Plus size={22} /></button></header>
      <div className="search-field"><Search size={18} /><input aria-label="Поиск чатов" placeholder="Поиск" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={16} /></button>}</div>
      <div className="chat-list">
        {filteredChats.map(chat => {
          const last = chat.messages.at(-1);
          return <button key={chat.id} className={`chat-row ${state.selectedId === chat.id ? 'selected' : ''}`} onClick={() => dispatch({ type: 'select', id: chat.id })} aria-current={state.selectedId === chat.id ? 'true' : undefined}>
            <Avatar name={chat.name} index={state.chats.indexOf(chat)} />
            <span className="chat-row-body"><span className="chat-row-top"><strong>{chat.name}</strong>{last && <time>{dateLabel(last.timestamp) === 'Сегодня' ? time(last.timestamp) : date(last.timestamp)}</time>}</span><span className="chat-row-preview"><span>{chat.draft ? <><em>Черновик: </em>{chat.draft}</> : last ? <>{last.direction === 'outgoing' && 'Вы: '}{last.text}</> : 'Напишите первое сообщение'}</span>{chat.unread > 0 && <b className="unread-badge">{chat.unread}</b>}</span></span>
          </button>;
        })}
        {filteredChats.length === 0 && <div className="sidebar-empty">{query ? 'Чаты не найдены' : <><MessageCircle size={34} /><strong>Пока нет чатов</strong><span>Создайте чат по номеру телефона</span><button onClick={() => setNewChatOpen(true)}>Создать чат <Plus size={16} /></button></>}</div>}
      </div>
      <footer className="sidebar-footer"><span className={`connection-dot ${connection}`} /><span>{demo ? 'Демо-режим' : connection === 'connected' ? `${name} подключён` : connection === 'reconnecting' ? 'Восстанавливаем связь…' : 'Нет подключения'}</span>{demo && <button onClick={onLogout}>Подключить <ChevronRight size={14} /></button>}</footer>
    </aside>
    <section className="conversation" aria-label="Переписка">
      {demo && <div className="demo-banner"><span>Демо-режим. Сообщения не отправляются в {name}.</span><button onClick={onLogout}>Подключить аккаунт </button></div>}
      {!demo && connectionError && <div className="connection-banner" role="status"><span>{connectionError}{connection === 'reconnecting' && ' Повторяем подключение автоматически.'}</span>{connection === 'stopped' && <button onClick={() => setRetryEpoch(n => n + 1)}>Переподключиться</button>}</div>}
      {helpOpen && <div className="help-panel"><div><strong>Как пользоваться чатом</strong><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Закрыть помощь"><X size={18} /></button></div><p>Создайте чат по номеру телефона и отправьте сообщение. Ответы появятся автоматически. Enter — отправить, Shift + Enter — новая строка.</p><p>Для подключения: авторизованный инстанс {name}, пустой Webhook URL и включённые входящие уведомления. История хранится в памяти до выхода или перезагрузки.</p><a href="https://green-api.com/telegram/docs/api/receiving/technology-http-api/" target="_blank" rel="noreferrer">Инструкция GREEN-API</a></div>}
      {selected ? <>
        <header className="conversation-header"><button className="icon-button back-button" aria-label="Назад к чатам" onClick={() => dispatch({ type: 'select', id: null })}><ArrowLeft size={22} /></button><Avatar name={selected.name} index={state.chats.indexOf(selected)} small /><div className="conversation-person"><h2>{selected.name}</h2><p>{typing === selected.id ? 'Печатает…' : selected.phone ? `+${selected.phone}` : name}</p></div><span className="text-only"><MessageCircle size={16} /> Telegram</span></header>
        <div className="message-scroll" role="log" aria-label="Сообщения чата" aria-live="polite" aria-relevant="additions text">
          <div className="message-container">
            {selected.messages.length === 0 && <div className="chat-start"><Avatar name={selected.name} index={state.chats.indexOf(selected)} /><h3>Начните разговор</h3><p>Напишите первое сообщение {selected.phone ? `на номер +${selected.phone}` : 'в этом чате'}.</p></div>}
            {selected.messages.map((message, index) => <div key={message.id}>
              {(index === 0 || date(message.timestamp) !== date(selected.messages[index - 1].timestamp)) && <div className="date-separator"><span>{dateLabel(message.timestamp)}</span></div>}
              <div className={`message-row ${message.direction}`}><div className={`message-bubble ${message.status === 'failed' ? 'failed' : ''}`}><p>{message.text}</p><span className="message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{time(message.timestamp)}</time>{message.direction === 'outgoing' && <span role="img" aria-label={({ sending: 'Отправляется', sent: 'В очереди отправки', delivered: 'Доставлено', read: 'Прочитано', failed: 'Ошибка отправки' })[message.status]} title={({ sending: 'Отправляется', sent: 'Принято GREEN-API в очередь', delivered: 'Доставлено', read: 'Прочитано', failed: 'Ошибка отправки' })[message.status]}>{message.status === 'sending' ? <span className="spinner small-spinner" /> : message.status === 'read' || message.status === 'delivered' ? <CheckCheck size={16} className={message.status === 'read' ? 'read-ticks' : ''} /> : message.status === 'failed' ? '!' : <Check size={16} />}</span>}</span>{message.status === 'failed' && <div className="message-error"><span>{message.error}</span><small>Если сервер не ответил, проверьте чат в {name} перед повторной отправкой.</small><button onClick={() => void send(message)} disabled={sending || connection !== 'connected'}>Повторить отправку</button></div>}</div></div>
            </div>)}
            {typing === selected.id && <div className="typing-indicator" role="status"><span className="sr-only">Собеседник печатает</span><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></div>}
            <div ref={bottom} />
          </div>
        </div>
        <footer className="composer-area"><form className="composer" onSubmit={submit}><textarea ref={textarea} aria-label="Сообщение" placeholder="Написать сообщение…" rows={1} maxLength={4000} value={selected.draft} onChange={e => dispatch({ type: 'draft', id: selected.id, text: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button className="send-button" type="submit" aria-label="Отправить сообщение" disabled={!selected.draft.trim() || sending || connection !== 'connected'}>{sending ? <span className="spinner" /> : <Send size={21} />}</button></form><div className="composer-hint"><span>Enter — отправить · Shift + Enter — новая строка</span><span>{selected.draft.length > 0 ? `${selected.draft.length} / 4000` : 'Только текст'}</span></div></footer>
      </> : <div className="welcome"><img className="welcome-plane" src="/paper-plane.svg" alt="" width="130" height="130" /><h2>Выберите чат</h2><p>Откройте разговор слева или создайте<br />новый чат по номеру телефона.</p><button className="primary-button" onClick={() => setNewChatOpen(true)}><Plus size={19} /> Новый чат</button><span className="welcome-footnote"><ShieldCheck size={16} /> Подключение через GREEN-API</span>{session.mode === 'live' && !session.statusesEnabled && <p className="status-hint">Для статусов доставки включите исходящие уведомления в GREEN-API.</p>}</div>}
    </section>
    {newChatOpen && <NewChatDialog onClose={() => setNewChatOpen(false)} onCreate={createChat} />}
  </main>;
}
