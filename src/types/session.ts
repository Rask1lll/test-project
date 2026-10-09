import type { Credentials } from './api';

export type Session =
  | { mode: 'demo' }
  | { mode: 'live'; credentials: Credentials; statusesEnabled: boolean };
