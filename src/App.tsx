import { useState } from 'react';
import ChatWorkspace, { type Session } from './components/ChatWorkspace';
import Login from './components/Login';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? <ChatWorkspace session={session} onLogout={() => setSession(null)} />
    : <Login onConnect={(credentials, statusesEnabled) => setSession({ mode: 'live', credentials, statusesEnabled })} onDemo={() => setSession({ mode: 'demo' })} />;
}
