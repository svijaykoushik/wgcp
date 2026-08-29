import { pgTable, serial, text, integer, primaryKey, boolean, doublePrecision } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
});

export const library = pgTable("library", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId] }),
}));

export const saves = pgTable("saves", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  slot: text("slot").notNull(),
  payload: text("payload").notNull(),
  checksum: text("checksum").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId, table.slot] }),
}));

export const achievements = pgTable("achievements", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  unlocked: boolean("unlocked").notNull().default(false),
  percentComplete: integer("percent_complete").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId, table.achievementId] }),
}));

export const stats = pgTable("stats", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  statId: text("stat_id").notNull(),
  value: doublePrecision("value").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId, table.statId] }),
}));

export const leaderboards = pgTable("leaderboards", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  leaderboardId: text("leaderboard_id").notNull(),
  score: doublePrecision("score").notNull(),
  metadata: text("metadata"),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId, table.leaderboardId] }),
}));

export const progression = pgTable("progression", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  level: integer("level").notNull().default(1),
  currentXp: integer("current_xp").notNull().default(0),
  totalXp: integer("total_xp").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.gameId] }),
}));
