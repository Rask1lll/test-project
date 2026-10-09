import type { Session } from '../types/session';

export interface ChatWorkspaceProps {
  session: Session;
  onLogout: () => void;
}

export interface AvatarProps {
  name: string;
  index?: number;
  small?: boolean;
}
