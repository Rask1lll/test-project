import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import App from './App';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe('user flows', () => {
  it('opens a marked demo without making API calls and returns to the login screen', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<StrictMode><App /></StrictMode>);
    await user.click(screen.getByRole('button', { name: 'Открыть демо-чат' }));
    expect(screen.getByText('Демо-режим. Сообщения не отправляются в Telegram.')).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('Привет! Да, всё готово');
    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects Telegram, resolves a number, sends text, shows incoming reply, retries a failed send and cancels polling on logout', async () => {
    let deliver: ((body: unknown) => void) | undefined;
    let lastPollSignal: AbortSignal | undefined;
    let shouldFail = false;
    let sentCount = 0;
    const fetchMock = vi.fn((url: string, options: RequestInit) => {
      if (url.includes('/getStateInstance/')) return Promise.resolve(response({ stateInstance: 'authorized' }));
      if (url.includes('/getSettings/')) return Promise.resolve(response({ typeInstance: 'telegram', incomingWebhook: 'yes', outgoingWebhook: 'yes', webhookUrl: '' }));
      if (url.includes('/checkAccount/')) return Promise.resolve(response({ exist: true, chatId: '10000000' }));
      if (url.includes('/sendMessage/')) return Promise.resolve(shouldFail ? response({}, 500) : response({ idMessage: `sent-${++sentCount}` }));
      if (url.includes('/deleteNotification/')) return Promise.resolve(response({ result: true }));
      if (url.includes('/receiveNotification/')) {
        lastPollSignal = options.signal as AbortSignal;
        return new Promise<Response>((resolve, reject) => {
          deliver = body => resolve(response(body));
          lastPollSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      throw new Error('Unexpected mock request');
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<StrictMode><App /></StrictMode>);
    const name = 'Telegram';
    await user.type(screen.getByLabelText('idInstance'), '4100000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'test-token-12345');
    await user.click(screen.getByRole('button', { name: `Подключить ${name}` }));
    const sidebar = await screen.findByRole('complementary', { name: 'Список чатов' });
    await user.click(within(sidebar).getByRole('button', { name: 'Новый чат' }));
    await user.type(screen.getByLabelText('Номер телефона'), '+7 999 123-45-67');
    await user.click(within(screen.getByRole('dialog', { name: 'Новый чат' })).getByRole('button', { name: 'Создать чат' }));
    const composer = await screen.findByRole('textbox', { name: 'Сообщение' });
    await user.type(composer, 'Привет из React');
    await user.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
    expect(await screen.findByLabelText('В очереди отправки')).toBeInTheDocument();
    const sendCall = fetchMock.mock.calls.find(c => c[0].includes('/sendMessage/'))!;
    expect(JSON.parse(sendCall[1].body as string)).toEqual({ chatId: '10000000', message: 'Привет из React' });
    await act(async () => deliver!({ receiptId: 42, body: {
      typeWebhook: 'incomingMessageReceived', idMessage: 'reply-1', timestamp: Date.now() / 1000,
      senderData: { chatId: '10000000', chatName: 'Анна', senderPhoneNumber: 79991234567 },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ из Telegram' } },
    } }));
    expect(await within(screen.getByRole('log')).findByText('Ответ из Telegram')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[0].includes('/deleteNotification/test-token-12345/42'))).toBe(true));
    shouldFail = true;
    await user.type(composer, 'Второе сообщение');
    await user.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
    expect(await screen.findByText('GREEN-API временно недоступен. Попробуйте ещё раз позже.')).toBeInTheDocument();
    expect(within(screen.getByRole('log')).getByText('Второе сообщение')).toBeInTheDocument();
    shouldFail = false;
    await user.click(screen.getByRole('button', { name: 'Повторить отправку' }));
    await waitFor(() => expect(screen.queryByText('Повторить отправку')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(lastPollSignal?.aborted).toBe(true);
    expect(screen.getByLabelText('apiTokenInstance')).toHaveValue('');
  });
});
