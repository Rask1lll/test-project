import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { normalizePhone } from '../api/greenApi';

export default function NewChatDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (phone: string, signal: AbortSignal) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLInputElement>('input')?.focus();
    return () => { controller.current?.abort(); element.close(); };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch (e) { setError((e as Error).message); return; }
    setBusy(true);
    const pending = new AbortController();
    controller.current = pending;
    try { await onCreate(normalized, pending.signal); if (!pending.signal.aborted) onClose(); }
    catch (e) { if (!pending.signal.aborted) setError((e as Error).message); }
    finally { if (!pending.signal.aborted) setBusy(false); }
  }
  return <dialog ref={dialog} className="new-chat-dialog" aria-labelledby="new-chat-title" onCancel={onClose} onClick={e => { if (e.target !== e.currentTarget) return; const bounds = e.currentTarget.getBoundingClientRect(); if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose(); }}>
    <button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть"><X size={21} /></button>
    <h2 id="new-chat-title">Новый чат</h2>
    <p>Введите номер человека, с которым хотите связаться в Telegram.</p>
    <form onSubmit={submit}>
      <label htmlFor="recipient">Номер телефона</label>
      <input id="recipient" type="tel" placeholder="+7 999 123-45-67" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus disabled={busy} />
      <small>Международный формат с кодом страны, например +7</small>
      {error && <p className="error-box" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Проверяем номер…' : 'Создать чат'}{busy && <span className="spinner" />}</button>
    </form>
  </dialog>;
}
