import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { createGreenApi, normalizeCredentials } from '../api/greenApi';
import type { Credentials } from '../types';
import Brand from './Brand';
import { useMobileViewportHeight } from '../useMobileViewportHeight';

export default function Login({ onConnect, onDemo }: {
  onConnect: (credentials: Credentials, statusesEnabled: boolean) => void;
  onDemo: () => void;
}) {
  const name = 'Telegram';
  const viewportHeight = useMobileViewportHeight();
  const [id, setId] = useState('');
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const suggestedUrl = /^\d{4}/.test(id) ? `https://${id.slice(0, 4)}.api.green-api.com` : 'https://api.green-api.com';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current && !pending.current.signal.aborted) return;
    setError('');
    let credentials: Credentials;
    try { credentials = normalizeCredentials({ idInstance: id, apiTokenInstance: token, apiUrl: url || suggestedUrl }); }
    catch (e) { setError((e as Error).message); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const result = await createGreenApi(credentials).connect(controller.signal);
      if (!controller.signal.aborted) onConnect(credentials, result.statusesEnabled);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) { setBusy(false); pending.current = null; }
    }
  }

  return <main className="login-page" style={viewportHeight ? { '--mobile-height': `${viewportHeight}px` } as CSSProperties : undefined}>
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-brand"><Brand /></div>
      <div className="login-content">
        <h1 id="login-title">Подключение Telegram</h1>
        <p className="login-intro">Введите данные инстанса из <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">кабинета GREEN-API</a>.</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="instance">idInstance</label>
          <div className="input-with-icon"><KeyRound size={18} /><input id="instance" value={id} onChange={e => setId(e.target.value)} placeholder="4100000001" inputMode="numeric" autoComplete="off" required disabled={busy} /></div>
          <label htmlFor="token">apiTokenInstance</label>
          <div className="input-with-icon"><LockKeyhole size={18} /><input id="token" type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="Ваш ключ доступа" autoComplete="off" spellCheck={false} required disabled={busy} /><button type="button" className="icon-button" onClick={() => setShowToken(!showToken)} aria-label={showToken ? 'Скрыть токен' : 'Показать токен'} aria-pressed={showToken}>{showToken ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <details className="connection-details"><summary>Адрес сервера API</summary><label htmlFor="api-url">apiUrl из личного кабинета</label><input id="api-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder={suggestedUrl} disabled={busy} /><p>Сверьте адрес с кабинетом. По умолчанию используется сервер по первым четырём цифрам idInstance.</p></details>
          {error && <p className="error-box" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy} type="submit">{busy ? 'Подключаемся…' : `Подключить ${name}`}{busy && <span className="spinner" />}</button>
        </form>
        <button className="demo-button" onClick={() => { pending.current?.abort(); onDemo(); }}>Открыть демо-чат</button>
        <p className="privacy-note"><ShieldCheck size={17} /> Ключ хранится только в этой вкладке и удаляется после выхода.</p>
      </div>
      <p className="setup-note">Для получения сообщений включите входящие уведомления в настройках инстанса.</p>
    </section>
    <section className="login-canvas" aria-label="О приложении">
      <div className="login-canvas-content"><img src="/paper-plane.svg" alt="" width="160" height="160" /><h2>Переписка появится здесь</h2><p>Подключите свой аккаунт или откройте демо,<br />чтобы посмотреть, как устроен чат.</p></div>
      <span className="canvas-caption">Текстовые сообщения через GREEN-API</span>
    </section>
  </main>;
}
