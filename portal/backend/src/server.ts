import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { z } from "zod";
import { db, pool } from "./db.js";
import { users, library } from "./schema.js";
import { eq, and } from "drizzle-orm";

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
