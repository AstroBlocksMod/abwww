import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	bytea,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const projectVisibility = pgEnum('project_visibility', ['private', 'unlisted', 'public']);
export type ProjectVisibility = (typeof projectVisibility.enumValues)[number];

/** `md5ext` (as it appears in project.json) to the sha256 of the asset bytes. */
export type AssetManifest = Record<string, string>;

export const projects = pgTable(
	'projects',
	{
		/** Numeric on purpose: the editor only accepts numeric project ids. */
		id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('Untitled'),
		instructions: text('instructions').notNull().default(''),
		/** "Notes and credits" in Scratch terms. */
		description: text('description').notNull().default(''),
		visibility: projectVisibility('visibility').notNull().default('private'),
		remixOfId: bigint('remix_of_id', { mode: 'number' }).references(
			(): AnyPgColumn => projects.id,
			{
				onDelete: 'set null'
			}
		),
		/** The Scratch project this was imported from, if any. */
		scratchProjectId: bigint('scratch_project_id', { mode: 'number' }),
		/** The current project.json, zstd-compressed. */
		projectJson: bytea('project_json').notNull(),
		/** sha256 of the uncompressed project.json. */
		projectJsonSha256: text('project_json_sha256').notNull(),
		projectJsonSize: integer('project_json_size').notNull(),
		assetManifest: jsonb('asset_manifest').$type<AssetManifest>().notNull().default({}),
		/** The git commit the current content was saved as. */
		headCommit: text('head_commit'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		sharedAt: timestamp('shared_at', { withTimezone: true })
	},
	(t) => [
		index('projects_owner_idx').on(t.ownerId, t.updatedAt),
		index('projects_shared_idx')
			.on(t.sharedAt)
			.where(sql`${t.visibility} = 'public'`),
		index('projects_scratch_idx').on(t.scratchProjectId)
	]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
