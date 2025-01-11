import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const priceTriggers = sqliteTable("price_triggers", {
  id: integer("id").primaryKey(),
  fid: integer("fid").notNull(),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  chainId: integer("chain_id").notNull(),
  usdPrice: real("usd_price").notNull(),
  interval: integer("interval").default(60).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
});

export const triggersMet = sqliteTable("triggers_met", {
  id: integer("id").primaryKey(),
  triggerId: integer("trigger_id").notNull(),
  currentPrice: real("current_price").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).defaultNow().notNull(),
});

export const triggerLogs = sqliteTable("trigger_logs", {
  id: integer("id").primaryKey(),
  triggerId: integer("trigger_id").notNull(),
  currentPrice: real("current_price").notNull(),
  checkResult: integer("check_result", { mode: "boolean" }).notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).defaultNow().notNull(),
});
