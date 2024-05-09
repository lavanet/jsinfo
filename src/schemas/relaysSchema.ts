// src/schemas/relaysSchema.ts

import { pgTable, text, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const lavaReportError = pgTable('lava_report_error', {
  id: serial('id').primaryKey(),
  created_at: timestamp('created_at'),
  provider: varchar('provider', { length: 255 }),
  spec_id: varchar('spec_id', { length: 255 }),
  errors: text('errors'),
});
export type LavaReportError = typeof lavaReportError.$inferSelect
export type InsertLavaReportError = typeof lavaReportError.$inferInsert