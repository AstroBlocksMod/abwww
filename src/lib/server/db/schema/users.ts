import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** An actor key pair for federation, as exported JWKs. */
export interface StoredKeyPair {
	algorithm: 'RSASSA-PKCS1-v1_5' | 'Ed25519';
	publicKey: JsonWebKey;
	privateKey: JsonWebKey;
}

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		username: text('username').notNull(),
		passwordHash: text('password_hash').notNull(),
		displayName: text('display_name'),
		bio: text('bio').notNull().default(''),
		/** The linked Scratch account, once verified. */
		scratchUsername: text('scratch_username'),
		scratchLinkedAt: timestamp('scratch_linked_at', { withTimezone: true }),
		keyPairs: jsonb('key_pairs').$type<StoredKeyPair[]>().notNull().default([]),
		isAdmin: boolean('is_admin').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
		uniqueIndex('users_scratch_username_lower_idx').on(sql`lower(${t.scratchUsername})`)
	]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
