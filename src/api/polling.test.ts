import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./greenApi";
import type { GreenApi } from "../types/api";
import { pollNotifications } from "./polling";

afterEach(() => vi.useRealTimers());
describe("queue consumer", () => {
  it("processes before ACK, drains service notifications and never overlaps requests", async () => {
    const order: string[] = [];
    const controller = new AbortController();
    const receiveNotification = vi.fn(async () => {
      order.push("receive");
      if (order.filter((s) => s === "receive").length > 1) {
        controller.abort();
        return null;
      }
      return { receiptId: 42, body: { typeWebhook: "serviceEvent" } };
    });
    const api = {
      receiveNotification,
      deleteNotification: vi.fn(async () => {
        order.push("delete");
      }),
    } as unknown as GreenApi;
    await pollNotifications(api, controller.signal, {
      onNotification: () => {
        order.push("process");
      },
      onStatus: vi.fn(),
    });
    expect(order).toEqual(["receive", "process", "delete", "receive"]);
    expect(api.deleteNotification).toHaveBeenCalledWith(42, controller.signal);
  });
  it("backs off after failed ACK and allows a receipt to be processed again", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const notification = {
      receiptId: 42,
      body: { typeWebhook: "incomingMessageReceived" },
    };
    const api = {
      receiveNotification: vi.fn().mockResolvedValue(notification),
      deleteNotification: vi
        .fn()
        .mockRejectedValueOnce(new ApiError("temporarily unavailable"))
        .mockImplementationOnce(async () => {
          controller.abort();
        }),
    } as unknown as GreenApi;
    const process = vi.fn();
    const status = vi.fn();
    const pending = pollNotifications(api, controller.signal, {
      onNotification: process,
      onStatus: status,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(process).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(
      "reconnecting",
      "temporarily unavailable",
    );
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(process).toHaveBeenCalledTimes(2);
  });
  it("stops on an invalid token instead of retrying indefinitely", async () => {
    const api = {
      receiveNotification: vi
        .fn()
        .mockRejectedValue(new ApiError("invalid credentials", 401)),
      deleteNotification: vi.fn(),
    } as unknown as GreenApi;
    const status = vi.fn();
    await pollNotifications(api, new AbortController().signal, {
      onNotification: vi.fn(),
      onStatus: status,
    });
    expect(status).toHaveBeenCalledWith("stopped", "invalid credentials");
    expect(api.receiveNotification).toHaveBeenCalledTimes(1);
    expect(api.deleteNotification).not.toHaveBeenCalled();
  });
  it("does not acknowledge a message if processing fails", async () => {
    const controller = new AbortController();
    const api = {
      receiveNotification: vi
        .fn()
        .mockResolvedValue({
          receiptId: 42,
          body: { typeWebhook: "serviceEvent" },
        }),
      deleteNotification: vi.fn(),
    } as unknown as GreenApi;
    await pollNotifications(api, controller.signal, {
      onNotification: () => {
        controller.abort();
        throw new Error("failed processing");
      },
      onStatus: vi.fn(),
    });
    expect(api.deleteNotification).not.toHaveBeenCalled();
  });
  it("acknowledges a state change before stopping so it cannot trap future connections", async () => {
    const api = {
      receiveNotification: vi
        .fn()
        .mockResolvedValue({
          receiptId: 42,
          body: { typeWebhook: "stateInstanceChanged" },
        }),
      deleteNotification: vi.fn().mockResolvedValue(undefined),
    } as unknown as GreenApi;
    await pollNotifications(api, new AbortController().signal, {
      onNotification: () => "stop",
      onStatus: vi.fn(),
    });
    expect(api.deleteNotification).toHaveBeenCalledTimes(1);
    expect(api.receiveNotification).toHaveBeenCalledTimes(1);
  });
});
