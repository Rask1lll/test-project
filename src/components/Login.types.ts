import type { Credentials } from '../types/api';

export interface LoginProps {
  onConnect: (credentials: Credentials, statusesEnabled: boolean) => void;
  onDemo: () => void;
}
