import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const apiCache = sqliteTable("api_cache", {
  cacheKey: text("cache_key").primaryKey(),
  body: text("body").notNull(),
  contentType: text("content_type").notNull().default("application/json; charset=utf-8"),
  expiresAt: integer("expires_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const noticeCache = sqliteTable("notice_cache", {
  purchaseKey: text("purchase_key").primaryKey(),
  noticeUrl: text("notice_url").notNull(),
  cnpj: text("cnpj").notNull(),
  pncpYear: integer("pncp_year").notNull(),
  pncpSequence: integer("pncp_sequence").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pncpLinkCache = sqliteTable("pncp_link_cache", {
  purchaseKey: text("purchase_key").primaryKey(),
  cnpj: text("cnpj").notNull(),
  pncpYear: integer("pncp_year").notNull(),
  pncpSequence: integer("pncp_sequence").notNull(),
  ataSequence: integer("ata_sequence"),
  updatedAt: integer("updated_at").notNull(),
});

export const deviceVisits = sqliteTable("device_visits", {
  visitKey: text("visit_key").primaryKey(),
  deviceId: text("device_id").notNull(),
  visitDate: text("visit_date").notNull(),
  lastSeen: integer("last_seen").notNull(),
  openCount: integer("open_count").notNull().default(1),
});
