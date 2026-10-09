import type {
  ApiRequestOptions, CheckAccountResponse, Credentials, DeleteNotificationResponse,
  GreenApi, InstanceSettingsResponse, InstanceStateResponse, QueueNotification, SendMessageResponse,
} from "../types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizePhone(value: string): string {
  if (/[^\d\s()+-]/.test(value))
    throw new Error(
      "Введите номер телефона, используя цифры, пробелы, +, скобки или дефис.",
    );
  const phone = value.replace(/\D/g, "");
  if (!/^[1-9]\d{6,14}$/.test(phone))
    throw new Error(
      "Введите международный номер с кодом страны: от 7 до 15 цифр.",
    );
  return phone;
}

export function normalizeCredentials(value: Credentials): Credentials {
  const idInstance = value.idInstance.trim();
  const apiTokenInstance = value.apiTokenInstance.trim();
  if (!/^\d{4,20}$/.test(idInstance))
    throw new Error("idInstance должен содержать от 4 до 20 цифр.");
  if (!/^[\w-]{8,256}$/.test(apiTokenInstance))
    throw new Error(
      "Проверьте apiTokenInstance: скопируйте ключ целиком из личного кабинета.",
    );
  let url: URL;
  try {
    url = new URL(value.apiUrl.trim());
  } catch {
    throw new Error("Укажите корректный apiUrl из личного кабинета GREEN-API.");
  }
  if (
    url.protocol !== "https:" ||
    !/^(?:\d+\.api|api)\.green-api\.com$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "apiUrl должен быть HTTPS-адресом API GREEN-API, например https://4100.api.green-api.com.",
    );
  }
  return { apiUrl: url.origin, idInstance, apiTokenInstance };
}

export const instanceStateMessage = (state: string) =>
  ({
    notAuthorized:
      "Авторизуйте аккаунт мессенджера в личном кабинете GREEN-API и попробуйте снова.",
    starting:
      "Инстанс запускается. Подождите несколько минут и попробуйте снова.",
    blocked:
      "Аккаунт мессенджера заблокирован. Проверьте его состояние в личном кабинете.",
    suspended:
      "У аккаунта мессенджера временные ограничения. Проверьте их в личном кабинете.",
    pendingPassword:
      "Завершите авторизацию с паролем в личном кабинете GREEN-API.",
  })[state] ?? "Инстанс недоступен. Проверьте его состояние в личном кабинете.";

function httpError(status: number, body: string): string {
  if (status === 401 || status === 403)
    return "Доступ отклонён. Проверьте idInstance, токен и состояние аккаунта в GREEN-API.";
  if (status === 429 || status === 469)
    return "Достигнут лимит запросов. Подождите и попробуйте снова.";
  if (/webhook url|webhookUrl/i.test(body))
    return "Очистите Webhook URL в настройках инстанса GREEN-API и подождите около минуты.";
  if (status === 400)
    return "GREEN-API отклонил запрос. Проверьте данные и настройки инстанса.";
  return "GREEN-API временно недоступен. Попробуйте ещё раз позже.";
}

export function createGreenApi(credentials: Credentials): GreenApi {
  const c = normalizeCredentials(credentials);
  const name = "Telegram";
  async function request<T>(
    method: string,
    verb: "GET" | "POST" | "DELETE",
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const url = `${c.apiUrl}/waInstance${c.idInstance}/${method}/${encodeURIComponent(c.apiTokenInstance)}${options.suffix ?? ""}${options.query ?? ""}`;
    const signal = options.signal
      ? AbortSignal.any([
          options.signal,
          AbortSignal.timeout(options.timeout ?? 25000),
        ])
      : AbortSignal.timeout(options.timeout ?? 25000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: verb,
        signal,
        referrerPolicy: "no-referrer",
        credentials: "omit",
        cache: "no-store",
        ...(options.body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(options.body),
            }),
      });
    } catch {
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      throw new ApiError(
        signal.aborted
          ? "Сервер не ответил вовремя. Проверьте соединение и попробуйте снова."
          : "Нет соединения с GREEN-API. Проверьте интернет и apiUrl.",
      );
    }
    if (!response.ok)
      throw new ApiError(
        httpError(response.status, await response.text()),
        response.status,
      );
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("GREEN-API вернул некорректный ответ.");
    }
  }

  return {
    async connect(signal?: AbortSignal) {
      const state = await request<InstanceStateResponse>(
        "getStateInstance",
        "GET",
        { signal },
      );
      if (state.stateInstance !== "authorized")
        throw new Error(instanceStateMessage(state.stateInstance));
      const settings = await request<InstanceSettingsResponse>("getSettings", "GET", { signal });
      if (settings.typeInstance && settings.typeInstance !== "telegram") {
        throw new Error(
          `Этот инстанс относится к другому мессенджеру. Выберите инстанс ${name}.`,
        );
      }
      if (settings.webhookUrl)
        throw new Error(
          "Для получения ответов очистите Webhook URL в настройках инстанса GREEN-API.",
        );
      if (settings.incomingWebhook !== "yes")
        throw new Error(
          "Включите «Получать уведомления о входящих сообщениях и файлах» в настройках GREEN-API.",
        );
      return { statusesEnabled: settings.outgoingWebhook === "yes" };
    },
    async checkAccount(phone: string, signal?: AbortSignal) {
      const normalizedPhone = normalizePhone(phone);
      const result = await request<CheckAccountResponse>("checkAccount", "POST", {
        body: { phoneNumber: Number(normalizedPhone) },
        signal,
      });
      if (result.status === false)
        throw new Error(
          "Не удалось проверить номер. Проверьте состояние инстанса и лимит запросов.",
        );
      if (!result.exist || !result.chatId)
        throw new Error(
          `Аккаунт ${name} не найден. Проверьте номер и настройки поиска получателя.`,
        );
      return result.chatId;
    },
    async sendMessage(chatId: string, message: string, signal?: AbortSignal) {
      if (!message.trim() || message.length > 4000)
        throw new Error("Сообщение должно содержать от 1 до 4000 символов.");
      const result = await request<SendMessageResponse>(
        "sendMessage",
        "POST",
        { body: { chatId, message }, signal },
      );
      if (!result.idMessage)
        throw new ApiError(
          `Не удалось подтвердить отправку сообщения. Проверьте чат в ${name}.`,
        );
      return result.idMessage;
    },
    receiveNotification: (signal: AbortSignal) =>
      request<QueueNotification | null>("receiveNotification", "GET", {
        query: "?receiveTimeout=20",
        signal,
        timeout: 30000,
      }),
    async deleteNotification(receiptId: number, signal: AbortSignal) {
      const result = await request<DeleteNotificationResponse>(
        "deleteNotification",
        "DELETE",
        { suffix: `/${receiptId}`, signal },
      );
      if (!result.result)
        throw new ApiError("Не удалось подтвердить получение уведомления.");
    },
  };
}
