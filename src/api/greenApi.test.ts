import { describe, expect, it, vi } from 'vitest';
import { ApiError, createGreenApi, normalizeCredentials, normalizePhone } from './greenApi';

const credentials = { apiUrl: 'https://4100.api.green-api.com', idInstance: '4100000001', apiTokenInstance: 'test-token-12345' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('GREEN-API Telegram contract', () => {
  it('resolves the Telegram chat ID instead of treating the phone as the sender ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ exist: true, chatId: '10000000' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createGreenApi(credentials).checkAccount('+7 (999) 123-45-67')).toBe('10000000');
    expect(fetchMock.mock.calls[0][0]).toBe('https://4100.api.green-api.com/waInstance4100000001/checkAccount/test-token-12345');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ phoneNumber: 79991234567 });
  });
  it('uses POST sendMessage with the resolved ID and preserves multiline text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ idMessage: 'server-id' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createGreenApi(credentials).sendMessage('10000000', 'Привет\nМир 👋')).toBe('server-id');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ chatId: '10000000', message: 'Привет\nМир 👋' }), credentials: 'omit' });
    await expect(createGreenApi(credentials).sendMessage('10000000', 'a'.repeat(4001))).rejects.toThrow('4000');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('checks authorization and receiving settings before starting a session', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ stateInstance: 'authorized' })).mockResolvedValueOnce(response({ typeInstance: 'telegram', webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createGreenApi(credentials).connect()).resolves.toEqual({ statusesEnabled: true });
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
      expect.stringContaining('/getStateInstance/'), expect.stringContaining('/getSettings/'),
    ]);
  });
  it('does not allow a connected session with a competing webhook', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ stateInstance: 'authorized' })).mockResolvedValueOnce(response({ typeInstance: 'telegram', webhookUrl: 'https://example.org', incomingWebhook: 'yes' })));
    await expect(createGreenApi(credentials).connect()).rejects.toThrow('Webhook URL');
  });
  it('reports unregistered numbers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ exist: false, chatId: '' })));
    await expect(createGreenApi(credentials).checkAccount('79991234567')).rejects.toThrow('не найден');
  });
  it('long polls and confirms receipts with DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response({ result: true }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createGreenApi(credentials);
    const signal = new AbortController().signal;
    await expect(api.receiveNotification(signal)).resolves.toBeNull();
    await api.deleteNotification(12345, signal);
    expect(fetchMock.mock.calls[0][0]).toContain('/receiveNotification/test-token-12345?receiveTimeout=20');
    expect(fetchMock.mock.calls[1][0]).toContain('/deleteNotification/test-token-12345/12345');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });
  it('maps HTTP failures without exposing server bodies or credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: credentials.apiTokenInstance }, 401)));
    const error = await createGreenApi(credentials).sendMessage('10000000', 'test').catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.message).not.toContain(credentials.apiTokenInstance);
  });
  it('aborts in-flight requests when the session ends', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const controller = new AbortController();
    const pending = createGreenApi(credentials).receiveNotification(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('input validation', () => {
  it('normalizes formatted international phone numbers and rejects arbitrary identifiers', () => {
    expect(normalizePhone('+375 (29) 123-45-67')).toBe('375291234567');
    expect(() => normalizePhone('7999abc1234567')).toThrow();
    expect(() => normalizePhone('123')).toThrow();
  });
  it('only sends tokens to an HTTPS GREEN-API host', () => {
    for (const apiUrl of ['https://evil.example', 'https://4100.api.green-api.com.evil.example', 'http://4100.api.green-api.com', 'https://api.green-api.com/custom', 'https://user:pass@api.green-api.com', 'https://api.green-api.com?token=foo']) {
      expect(() => normalizeCredentials({ ...credentials, apiUrl })).toThrow();
    }
    expect(normalizeCredentials({ ...credentials, apiUrl: `${credentials.apiUrl}/` }).apiUrl).toBe(credentials.apiUrl);
  });
});

describe('Telegram adapter', () => {
  const telegram = credentials;
  it('accepts an authorized Telegram instance and resolves an international phone', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ stateInstance: 'authorized' }))
      .mockResolvedValueOnce(response({ typeInstance: 'telegram', incomingWebhook: 'yes', outgoingWebhook: 'yes', webhookUrl: '' }))
      .mockResolvedValueOnce(response({ exist: true, chatId: '123456789' }))
      .mockResolvedValueOnce(response({ idMessage: 'telegram-message-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createGreenApi(telegram);
    await api.connect();
    const chatId = await api.checkAccount('+44 7700 900123');
    await api.sendMessage(chatId, 'Привет в Telegram');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ phoneNumber: 447700900123 });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ chatId: '123456789', message: 'Привет в Telegram' });
  });
  it('rejects an instance for another messenger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ stateInstance: 'authorized' })).mockResolvedValueOnce(response({ typeInstance: 'whatsapp', incomingWebhook: 'yes' })));
    await expect(createGreenApi(telegram).connect()).rejects.toThrow('Выберите инстанс Telegram');
  });
  it('distinguishes an unavailable Telegram account from a valid chat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ exist: false, chatId: '' })));
    await expect(createGreenApi(telegram).checkAccount('77001234567')).rejects.toThrow('Аккаунт Telegram не найден');
  });
});
