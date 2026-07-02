/**
 * civic-education.ts — Lecciones, quizzes y progreso gamificado
 * Inspirado en Civix (civic education module + gamification)
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { civicEducationTopicsTable, userEducationProgressTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { optionalAuth } from "./auth";

const router: IRouter = Router();

// ── GET /civic-education/topics — lista de lecciones ───────────────────────
router.get("/civic-education/topics", async (_req, res) => {
  try {
    const topics = await db.select()
      .from(civicEducationTopicsTable)
      .where(eq(civicEducationTopicsTable.isActive, true))
      .orderBy(civicEducationTopicsTable.sortOrder);
    return res.json({ topics: topics.map(t => ({ ...t, questions: JSON.parse(t.questions) })) });
  } catch (err) {
    _req.log.error({ err }, "Failed to get education topics");
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── GET /civic-education/topics/:slug — lección individual ─────────────────
router.get("/civic-education/topics/:slug", async (req, res) => {
  try {
    const [topic] = await db.select()
      .from(civicEducationTopicsTable)
      .where(and(eq(civicEducationTopicsTable.slug, req.params.slug as string), eq(civicEducationTopicsTable.isActive, true)))
      .limit(1);
    if (!topic) return res.status(404).json({ error: "Lección no encontrada." });
    return res.json({ ...topic, questions: JSON.parse(topic.questions) });
  } catch (err) {
    req.log.error({ err }, "Failed to get topic");
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── POST /civic-education/progress — guardar progreso de usuario ────────────
router.post("/civic-education/progress", optionalAuth, async (req, res) => {
  const parsed = z.object({
    topicId: z.number().int(),
    completed: z.boolean(),
    score: z.number().int().min(0).max(100),
    xpEarned: z.number().int().min(0),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });

  const user = (req as any).jwtUser;
  const userId = user ? Number(user.sub) : 0;

  try {
    const [existing] = await db.select()
      .from(userEducationProgressTable)
      .where(and(eq(userEducationProgressTable.userId, userId), eq(userEducationProgressTable.topicId, parsed.data.topicId)))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(userEducationProgressTable)
        .set({
          completed: parsed.data.completed || existing.completed,
          score: Math.max(parsed.data.score, existing.score),
          xpEarned: Math.max(parsed.data.xpEarned, existing.xpEarned),
          completedAt: parsed.data.completed ? new Date() : existing.completedAt,
        })
        .where(eq(userEducationProgressTable.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [progress] = await db.insert(userEducationProgressTable).values({
      userId,
      topicId: parsed.data.topicId,
      completed: parsed.data.completed,
      score: parsed.data.score,
      xpEarned: parsed.data.xpEarned,
      completedAt: parsed.data.completed ? new Date() : undefined,
    }).returning();

    return res.status(201).json(progress);
  } catch (err) {
    req.log.error({ err }, "Failed to save progress");
    return res.status(500).json({ error: "Error interno." });
  }
});

// ── GET /civic-education/progress — progreso del usuario ───────────────────
router.get("/civic-education/progress", optionalAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  if (!user) return res.json({ progress: [], totalXp: 0 });

  try {
    const progress = await db.select()
      .from(userEducationProgressTable)
      .where(eq(userEducationProgressTable.userId, Number(user.sub)));

    const totalXp = progress.reduce((s, p) => s + p.xpEarned, 0);
    return res.json({ progress, totalXp });
  } catch (err) {
    req.log.error({ err }, "Failed to get progress");
    return res.status(500).json({ error: "Error interno." });
  }
});

export default router;
