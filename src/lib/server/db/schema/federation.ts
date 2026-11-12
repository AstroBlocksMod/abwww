import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** A remote actor following one of our users. */
export const followers = pgTable(
	'followers',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		actorUri: text('actor_uri').notNull(),
		inboxUri: text('inbox_uri').notNull(),
		sharedInboxUri: text('shared_inbox_uri'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('followers_user_actor_idx').on(t.userId, t.actorUri)]
);

export type Follower = typeof followers.$inferSelect;
