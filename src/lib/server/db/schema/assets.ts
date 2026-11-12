import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * One row per distinct blob. The bytes live in the blob store under the same sha256. Which
 * projects use a blob, and under which md5 name, is in each project's asset manifest.
 */
export const assets = pgTable('assets', {
	sha256: text('sha256').primaryKey(),
	size: integer('size').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type Asset = typeof assets.$inferSelect;
