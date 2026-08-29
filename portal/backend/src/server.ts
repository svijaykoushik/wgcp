import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, pool } from "./db.js";
import { users, library, saves, achievements, stats, leaderboards, progression } from "./schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: true, // Allow requests from any origin (e.g. localhost) since it's local
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Helper to authenticate user from cookies
async function getAuthenticatedUser(req: express.Request) {
  const userIdStr = req.cookies.userId;
  if (!userIdStr) return null;
  const userId = parseInt(userIdStr, 10);
  if (isNaN(userId)) return null;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user || null;
  } catch (err) {
    console.error("Error retrieving user from db", err);
    return null;
  }
}

// Auth endpoints
app.post("/api/v1/auth/login", async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const { username } = parsed.data;

  try {
    let user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      // Seed dynamically or return 401? The requirement says:
      // "seed a user directly and make the user login. skip registration process today."
      // Let's seed it automatically or return 401. Let's make it so if they enter "testuser", it exists.
      // If it doesn't exist, let's create it dynamically just in case to be flexible, but primarily "testuser".
      if (username === "testuser") {
        const result = await db.insert(users).values({ username }).returning();
        user = result[0];
      } else {
        return res.status(401).json({ error: "User not found" });
      }
    }

    res.cookie("userId", user.id.toString(), {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days session persistence
      path: "/",
      sameSite: "lax",
    });

    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error during login" });
  }
});

app.post("/api/v1/auth/logout", (req, res) => {
  res.clearCookie("userId", { path: "/" });
  return res.json({ success: true });
});

app.get("/api/v1/auth/me", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json(user);
});

// Library endpoints
app.get("/api/v1/library", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const list = await db.query.library.findMany({
      where: eq(library.userId, user.id),
    });
    return res.json(list.map((item) => item.gameId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to retrieve library" });
  }
});

app.post("/api/v1/library", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const schema = z.object({
    gameId: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid gameId" });
  }

  const { gameId } = parsed.data;

  try {
    await db.insert(library).values({
      userId: user.id,
      gameId,
    }).onConflictDoNothing();

    const list = await db.query.library.findMany({
      where: eq(library.userId, user.id),
    });
    return res.json(list.map((item) => item.gameId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to add to library" });
  }
});

app.delete("/api/v1/library/:gameId", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { gameId } = req.params;

  try {
    await db.delete(library).where(
      and(
        eq(library.userId, user.id),
        eq(library.gameId, gameId)
      )
    );
    const list = await db.query.library.findMany({
      where: eq(library.userId, user.id),
    });
    return res.json(list.map((item) => item.gameId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to remove from library" });
  }
});

// Memory store for leaderboard verification tokens and stats idempotency logs
const verificationTokens = new Map<string, { userId: number; gameId: string; leaderboardId: string; expiresAt: number; telemetry: { sessionLengthMs: number; gameActivityScore: number } }>();
const processedBatches = new Set<string>();

// Clean up expired verification tokens every minute
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    const now = Date.now();
    for (const [token, data] of verificationTokens.entries()) {
      if (data.expiresAt < now) {
        verificationTokens.delete(token);
      }
    }
  }, 60000);
}

// 1. Storage Saves API
app.get("/api/v1/games/:gameId/saves/:slot", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, slot } = req.params;

  try {
    const record = await db.query.saves.findFirst({
      where: and(
        eq(saves.userId, user.id),
        eq(saves.gameId, gameId),
        eq(saves.slot, slot)
      ),
    });

    if (!record) {
      return res.status(404).json({ error: "Save not found" });
    }

    return res.json({
      payload: record.payload,
      checksum: record.checksum,
      revision: record.revision,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch save" });
  }
});

app.post("/api/v1/games/:gameId/saves/:slot", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, slot } = req.params;
  
  const schema = z.object({
    payload: z.string(),
    checksum: z.string(),
    revision: z.number().int(),
    updatedAt: z.number().int(),
    force: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid save payload" });
  }

  const { payload, checksum, revision, updatedAt, force } = parsed.data;

  try {
    const existing = await db.query.saves.findFirst({
      where: and(
        eq(saves.userId, user.id),
        eq(saves.gameId, gameId),
        eq(saves.slot, slot)
      ),
    });

    let newRevision = 1;
    if (existing) {
      if (!force && revision < existing.revision) {
        return res.status(409).json({
          code: "ERROR_SYNC_PENDING_RESOLUTION",
          message: "Revision conflict detected",
          details: { serverRevision: existing.revision }
        });
      }
      newRevision = existing.revision + 1;
    }

    await db.insert(saves).values({
      userId: user.id,
      gameId,
      slot,
      payload,
      checksum,
      revision: newRevision,
      updatedAt,
    }).onConflictDoUpdate({
      target: [saves.userId, saves.gameId, saves.slot],
      set: { payload, checksum, revision: newRevision, updatedAt },
    });

    return res.json({
      success: true,
      revision: newRevision,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save state" });
  }
});

// 2. Achievements API
app.get("/api/v1/games/:gameId/achievements", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId } = req.params;

  try {
    const records = await db.query.achievements.findMany({
      where: and(
        eq(achievements.userId, user.id),
        eq(achievements.gameId, gameId)
      ),
    });
    return res.json(records);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to get achievements" });
  }
});

app.post("/api/v1/games/:gameId/achievements/:achievementId/unlock", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, achievementId } = req.params;
  const schema = z.object({ txId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid transaction ID" });

  const { txId } = parsed.data;

  try {
    // Check if transaction has been executed (idempotency check)
    if (processedBatches.has(txId)) {
      return res.json({ success: true, alreadyUnlocked: true });
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(achievements).values({
      userId: user.id,
      gameId,
      achievementId,
      unlocked: true,
      percentComplete: 100,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [achievements.userId, achievements.gameId, achievements.achievementId],
      set: { unlocked: true, percentComplete: 100, updatedAt: now },
    });

    processedBatches.add(txId);

    return res.json({ success: true, unlocked: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to unlock achievement" });
  }
});

app.post("/api/v1/games/:gameId/achievements/:achievementId/increment", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, achievementId } = req.params;
  const schema = z.object({
    txId: z.string().uuid(),
    step: z.number().int().positive()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid arguments" });

  const { txId, step } = parsed.data;

  try {
    if (processedBatches.has(txId)) {
      const record = await db.query.achievements.findFirst({
        where: and(
          eq(achievements.userId, user.id),
          eq(achievements.gameId, gameId),
          eq(achievements.achievementId, achievementId)
        ),
      });
      return res.json(record);
    }

    const existing = await db.query.achievements.findFirst({
      where: and(
        eq(achievements.userId, user.id),
        eq(achievements.gameId, gameId),
        eq(achievements.achievementId, achievementId)
      ),
    });

    let currentPercent = existing ? existing.percentComplete : 0;
    let newPercent = Math.min(100, currentPercent + step);
    let unlocked = newPercent >= 100;
    const now = Math.floor(Date.now() / 1000);

    await db.insert(achievements).values({
      userId: user.id,
      gameId,
      achievementId,
      unlocked,
      percentComplete: newPercent,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [achievements.userId, achievements.gameId, achievements.achievementId],
      set: { unlocked, percentComplete: newPercent, updatedAt: now },
    });

    processedBatches.add(txId);

    return res.json({
      achievementId,
      percentComplete: newPercent,
      unlocked,
      lastUpdated: now,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to increment achievement" });
  }
});

// 3. Leaderboards API
app.post("/api/v1/games/:gameId/leaderboards/:leaderboardId/token", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, leaderboardId } = req.params;
  const schema = z.object({
    sessionLengthMs: z.number().positive(),
    gameActivityScore: z.number().nonnegative()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid telemetry payload" });

  const telemetry = parsed.data;
  
  // Create single-use token
  const token = randomUUID();

  const tokenData = {
    userId: user.id,
    gameId,
    leaderboardId,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute validity
    telemetry
  };

  verificationTokens.set(token, tokenData);

  return res.json({ token });
});

app.post("/api/v1/games/:gameId/leaderboards/:leaderboardId", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, leaderboardId } = req.params;
  const schema = z.object({
    token: z.string().uuid(),
    score: z.number(),
    metadata: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid submission data" });

  const { token, score, metadata } = parsed.data;

  try {
    const tokenData = verificationTokens.get(token);
    if (!tokenData) {
      return res.status(403).json({
        code: "ERROR_TAMPER_DETECTED",
        message: "Invalid or expired verification token"
      });
    }

    // single-use validation
    verificationTokens.delete(token);

    if (tokenData.userId !== user.id || tokenData.gameId !== gameId || tokenData.leaderboardId !== leaderboardId) {
      return res.status(403).json({
        code: "ERROR_TAMPER_DETECTED",
        message: "Token context mismatch"
      });
    }

    if (tokenData.expiresAt < Date.now()) {
      return res.status(403).json({
        code: "ERROR_TAMPER_DETECTED",
        message: "Verification token expired"
      });
    }

    // Telemetry-bound Plausibility Check (Finding 2 / P-003 §3.3)
    const sessionSecs = tokenData.telemetry.sessionLengthMs / 1000;
    const maxPossiblePointsPerSec = 2000; // Configured bounds limit
    if (score > sessionSecs * maxPossiblePointsPerSec + 100) {
      return res.status(400).json({
        code: "ERROR_TAMPER_DETECTED",
        message: "Score value physically impossible given session telemetry snapshot"
      });
    }

    // Save only if it is a personal best
    const existing = await db.query.leaderboards.findFirst({
      where: and(
        eq(leaderboards.userId, user.id),
        eq(leaderboards.gameId, gameId),
        eq(leaderboards.leaderboardId, leaderboardId)
      )
    });

    const now = Math.floor(Date.now() / 1000);
    if (!existing || score > existing.score) {
      await db.insert(leaderboards).values({
        userId: user.id,
        gameId,
        leaderboardId,
        score,
        metadata: metadata || null,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [leaderboards.userId, leaderboards.gameId, leaderboards.leaderboardId],
        set: { score, metadata: metadata || null, updatedAt: now },
      });
    }

    return res.json({ success: true, personalBest: !existing || score > existing.score });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to submit score" });
  }
});

app.get("/api/v1/games/:gameId/leaderboards/:leaderboardId", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId, leaderboardId } = req.params;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const offset = parseInt(req.query.offset as string, 10) || 0;

  try {
    const scoresList = await db.select({
      userId: leaderboards.userId,
      username: users.username,
      score: leaderboards.score,
      metadata: leaderboards.metadata,
      updatedAt: leaderboards.updatedAt
    })
    .from(leaderboards)
    .innerJoin(users, eq(leaderboards.userId, users.id))
    .where(and(eq(leaderboards.gameId, gameId), eq(leaderboards.leaderboardId, leaderboardId)))
    .orderBy(desc(leaderboards.score))
    .limit(limit)
    .offset(offset);

    const scores = scoresList.map((entry, index) => ({
      rank: offset + index + 1,
      displayName: entry.username,
      score: entry.score,
      metadata: entry.metadata || undefined,
      timestamp: entry.updatedAt * 1000,
      isMe: entry.userId === user.id
    }));

    return res.json(scores);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// 4. Player Stats API (Double-Buffered Delta Ingestion)
app.get("/api/v1/games/:gameId/stats", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId } = req.params;

  try {
    const records = await db.query.stats.findMany({
      where: and(
        eq(stats.userId, user.id),
        eq(stats.gameId, gameId)
      )
    });
    return res.json(records.map(r => ({
      statId: r.statId,
      value: r.value,
      lastUpdated: r.updatedAt * 1000
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to get stats" });
  }
});

app.post("/api/v1/games/:gameId/stats", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId } = req.params;
  const schema = z.object({
    batchId: z.string().uuid(),
    operations: z.record(
      z.string(),
      z.object({
        op: z.enum(["DELTA", "SET"]),
        value: z.number().finite()
      })
    )
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid stats payload" });

  const { batchId, operations } = parsed.data;

  try {
    // Idempotency check: Dedupes processed batches
    if (processedBatches.has(batchId)) {
      return res.json({ success: true, alreadyProcessed: true });
    }

    const now = Math.floor(Date.now() / 1000);

    for (const [statId, opData] of Object.entries(operations)) {
      if (opData.op === "SET") {
        await db.insert(stats).values({
          userId: user.id,
          gameId,
          statId,
          value: opData.value,
          updatedAt: now
        }).onConflictDoUpdate({
          target: [stats.userId, stats.gameId, stats.statId],
          set: { value: opData.value, updatedAt: now }
        });
      } else {
        // Delta atomic update: get existing or default to 0
        const existing = await db.query.stats.findFirst({
          where: and(
            eq(stats.userId, user.id),
            eq(stats.gameId, gameId),
            eq(stats.statId, statId)
          )
        });
        const oldValue = existing ? existing.value : 0;
        const newValue = oldValue + opData.value;

        await db.insert(stats).values({
          userId: user.id,
          gameId,
          statId,
          value: newValue,
          updatedAt: now
        }).onConflictDoUpdate({
          target: [stats.userId, stats.gameId, stats.statId],
          set: { value: newValue, updatedAt: now }
        });
      }
    }

    processedBatches.add(batchId);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to process stats delta" });
  }
});

// 5. Progression API
app.get("/api/v1/games/:gameId/progression", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId } = req.params;

  try {
    const record = await db.query.progression.findFirst({
      where: and(
        eq(progression.userId, user.id),
        eq(progression.gameId, gameId)
      )
    });

    if (!record) {
      return res.json({
        level: 1,
        currentXP: 0,
        totalXP: 0,
        xpRequiredForNext: 100
      });
    }

    return res.json({
      level: record.level,
      currentXP: record.currentXp,
      totalXP: record.totalXp,
      xpRequiredForNext: record.level * 100
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch progression" });
  }
});

app.post("/api/v1/games/:gameId/progression/addXP", async (req, res) => {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { gameId } = req.params;
  const schema = z.object({ amount: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid amount" });

  const { amount } = parsed.data;

  try {
    const record = await db.query.progression.findFirst({
      where: and(
        eq(progression.userId, user.id),
        eq(progression.gameId, gameId)
      )
    });

    let level = record ? record.level : 1;
    let currentXp = record ? record.currentXp : 0;
    let totalXp = record ? record.totalXp : 0;
    
    totalXp += amount;
    currentXp += amount;

    let leveledUp = false;
    // Level Up Formula: XP needed for level L -> L = L * 100
    while (currentXp >= level * 100) {
      currentXp -= level * 100;
      level += 1;
      leveledUp = true;
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(progression).values({
      userId: user.id,
      gameId,
      level,
      currentXp,
      totalXp,
      updatedAt: now
    }).onConflictDoUpdate({
      target: [progression.userId, progression.gameId],
      set: { level, currentXp, totalXp, updatedAt: now }
    });

    return res.json({
      progression: {
        level,
        currentXP: currentXp,
        totalXP: totalXp,
        xpRequiredForNext: level * 100
      },
      leveledUp
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to add experience points" });
  }
});


// Seed function to seed the database
async function seedUser() {
  let retries = 5;
  while (retries > 0) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.username, "testuser"),
      });
      if (!existing) {
        await db.insert(users).values({ username: "testuser" });
        console.log("Seeded default 'testuser'.");
      } else {
        console.log("'testuser' already exists in the database.");
      }
      break;
    } catch (err) {
      console.error(`Database seeding failed. Retrying... (${retries} attempts left)`);
      retries -= 1;
      if (retries === 0) {
        console.error("Failed to connect/seed the database.", err);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}

// Start Server
if (process.env.NODE_ENV !== "test") {
  app.listen(port, async () => {
    console.log(`Backend listening on port ${port}`);
    await seedUser();
  });
}

export default app;
