import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "./auth";
import { sendTelegramMessage } from "../lib/telegram";

const router: IRouter = Router();

function genLinkCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // 8 hex
}

async function ensureLinkCode(districtId: number): Promise<string> {
  const [d] = await db
    .select({ code: districtsTable.telegramLinkCode })
    .from(districtsTable)
    .where(eq(districtsTable.id, districtId))
    .limit(1);
  if (d?.code) return d.code;
  const code = genLinkCode();
  await db
    .update(districtsTable)
    .set({ telegramLinkCode: code })
    .where(eq(districtsTable.id, districtId));
  return code;
}

// ── GET /districts/:id/telegram — estado del canal (superadmin) ──────────────
router.get(
  "/districts/:id/telegram",
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const [d] = await db
        .select({
          name: districtsTable.name,
          chatId: districtsTable.telegramChatId,
          code: districtsTable.telegramLinkCode,
        })
        .from(districtsTable)
        .where(eq(districtsTable.id, id))
        .limit(1);
      if (!d) return res.status(404).json({ error: "Distrito no encontrado." });
      const linkCode = d.code ?? (await ensureLinkCode(id));
      return res.json({
        district: d.name,
        chatId: d.chatId ?? null,
        linked: Boolean(d.chatId),
        linkCode,
        botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "radar_vecinal_bot",
      });
    } catch (err) {
      req.log.error({ err }, "telegram status failed");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── PUT /districts/:id/telegram — fijar/limpiar canal manualmente ────────────
router.put(
  "/districts/:id/telegram",
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const schema = z.object({
      // id de canal ("-1001234567890") o @usuario del canal; null/"" desvincula
      chatId: z.string().trim().max(64).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "chatId inválido." });
    }
    try {
      const id = parseInt(req.params.id as string);
      const raw = parsed.data.chatId?.trim() || null;
      if (raw && !/^(-?\d{5,20}|@[A-Za-z0-9_]{4,})$/.test(raw)) {
        return res.status(400).json({
          error:
            "Formato de canal inválido. Usa el id (-100…) o @usuario del canal.",
        });
      }
      const [updated] = await db
        .update(districtsTable)
        .set({ telegramChatId: raw })
        .where(eq(districtsTable.id, id))
        .returning({ chatId: districtsTable.telegramChatId });
      if (!updated)
        return res.status(404).json({ error: "Distrito no encontrado." });
      return res.json({
        chatId: updated.chatId ?? null,
        linked: Boolean(updated.chatId),
      });
    } catch (err) {
      req.log.error({ err }, "telegram set channel failed");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /telegram/webhook — recibe updates del bot (auto-vinculación) ────────
// Público (lo llama Telegram). Se valida con el secret de setWebhook.
router.post("/telegram/webhook", async (req: Request, res: Response) => {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && req.header("X-Telegram-Bot-Api-Secret-Token") !== secret) {
      return res.sendStatus(403);
    }

    const update = req.body ?? {};
    const msg = update.message ?? update.channel_post;
    const text: string | undefined = msg?.text;
    const chatId: string | undefined =
      msg?.chat?.id != null ? String(msg.chat.id) : undefined;

    if (!msg || !text || !chatId) return res.sendStatus(200);

    // /vincular <CÓDIGO>  (acepta /vincular@bot y espacios)
    const m = text.trim().match(/^\/vincular(?:@\w+)?\s+([A-Za-z0-9]{4,16})/i);
    if (m) {
      const code = m[1].toUpperCase();
      const [d] = await db
        .select({ id: districtsTable.id, name: districtsTable.name })
        .from(districtsTable)
        .where(eq(districtsTable.telegramLinkCode, code))
        .limit(1);
      if (!d) {
        await sendTelegramMessage(
          chatId,
          "❌ Código no válido. Revisa el código de vinculación en el panel de Radar Vecinal.",
        );
        return res.sendStatus(200);
      }
      await db
        .update(districtsTable)
        .set({ telegramChatId: chatId })
        .where(eq(districtsTable.id, d.id));
      await sendTelegramMessage(
        chatId,
        `✅ Canal vinculado a <b>${d.name}</b>.\nLos reportes de este distrito llegarán automáticamente aquí.`,
      );
      return res.sendStatus(200);
    }

    // /start o ayuda
    if (/^\/(start|ayuda|help)\b/i.test(text.trim())) {
      await sendTelegramMessage(
        chatId,
        "👋 <b>Radar Vecinal</b>\nPara recibir los reportes de tu distrito, escribe:\n<code>/vincular TU_CÓDIGO</code>\n(el código está en el panel de administración).",
      );
    }
    return res.sendStatus(200);
  } catch (err) {
    req.log.error({ err }, "telegram webhook failed");
    // Siempre 200 para que Telegram no reintente en bucle
    return res.sendStatus(200);
  }
});

export default router;
