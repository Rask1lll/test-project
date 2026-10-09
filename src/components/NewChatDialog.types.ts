export interface NewChatDialogProps {
  onClose: () => void;
  onCreate: (phone: string, signal: AbortSignal) => Promise<void>;
}
