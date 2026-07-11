/**
 * Telegram: la función es no-op segura cuando faltan las variables de entorno
 * (nunca lanza ni bloquea la creación de reportes).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("telegram notifier", () => {
  const OLD = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...OLD };
    vi.restoreAllMocks();
  });

  it("está deshabilitado si faltan TELEGRAM_BOT_TOKEN/CHAT_ID", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const mod = await import("../lib/telegram");
    expect(mod.telegramEnabled()).toBe(false);
  });

  it("notifyReportToTelegram devuelve false y NO hace fetch si está deshabilitado", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    const mod = await import("../lib/telegram");
    const ok = await mod.notifyReportToTelegram({
      id: 1,
      title: "t",
      description: "d",
      category: "robbery",
      urgency: "high",
      latitude: -12.04,
      longitude: -76.97,
    });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("habilitado cuando ambas variables están presentes", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_CHAT_ID = "-100999";
    const mod = await import("../lib/telegram");
    expect(mod.telegramEnabled()).toBe(true);
  });
});
