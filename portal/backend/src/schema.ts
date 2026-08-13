import { pgTable, serial, text, integer, primaryKey } from "drizzle-orm/pg-core";

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
