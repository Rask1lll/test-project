import { ApiError } from "./greenApi";
import type { GreenApi, PollingCallbacks } from "../types/api";

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** A single consumer. Acknowledge only after processing; retries may redeliver a receipt. */
export async function pollNotifications(
  api: GreenApi,
  signal: AbortSignal,
  callbacks: PollingCallbacks,
) {
  let failures = 0;
  while (!signal.aborted) {
    try {
      const notification = await api.receiveNotification(signal);
      if (signal.aborted) return;
      if (notification) {
        const disposition = callbacks.onNotification(notification.body);
        if (signal.aborted) return;
        await api.deleteNotification(notification.receiptId, signal);
        if (disposition === "stop") return;
      } else {
        // Protect against an endpoint returning null immediately instead of long polling.
        await delay(350, signal);
      }
      failures = 0;
      callbacks.onStatus("connected");
    } catch (error) {
      if (signal.aborted) return;
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось получить сообщения.";
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
        callbacks.onStatus("stopped", message);
        return;
      }
      callbacks.onStatus("reconnecting", message);
      failures += 1;
      try {
        await delay(
          Math.min(1000 * 2 ** Math.min(failures - 1, 5), 20000),
          signal,
        );
      } catch {
        return;
      }
    }
  }
}
