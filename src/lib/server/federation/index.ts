import { createFederation, importJwk, type Federation } from '@fedify/fedify';
import {
	Accept,
	Create,
	Endpoints,
	Follow,
	isActor,
	Note,
	Person,
	PUBLIC_COLLECTION,
	Undo,
	type Recipient
} from '@fedify/fedify/vocab';
import { and, count, eq } from 'drizzle-orm';
import { findUserByUsername } from '../auth/users.js';
import { config } from '../config.js';
import { followers, projects, users, type Project } from '../db/schema/index.js';
import { db } from '../platform/db.js';
import { newId } from '../platform/ids.js';
import { kv } from '../platform/kv.js';
import { lazy } from '../platform/lazy.js';
import { escapeHtml } from '../platform/text.js';
import { ensureKeyPairs } from './keys.js';
import { ValkeyKvStore } from './kv.js';
import { ValkeyMessageQueue } from './queue.js';

/**
 * ActivityPub through Fedify. Users are `Person` actors at /users/{username}; a shared project is
 * announced to followers as a `Create(Note)` linking to its page. Everything incoming is verified
 * by Fedify before it reaches the listeners below.
 */
export const federation: Federation<void> = lazy(createAbwwwFederation);

function createAbwwwFederation(): Federation<void> {
	const instance = createFederation<void>({
		kv: new ValkeyKvStore(kv),
		queue: new ValkeyMessageQueue(kv),
		origin: config.ORIGIN,
		manuallyStartQueue: true
	});
	registerDispatchers(instance);
	return instance;
}

/** Only the exact spelling the user registered with is an actor. */
async function actorUser(identifier: string) {
	const user = await findUserByUsername(identifier);
	return user && user.username === identifier ? user : null;
}

function registerDispatchers(fed: Federation<void>): void {
	fed
		.setActorDispatcher('/users/{identifier}', async (ctx, identifier) => {
			const user = await actorUser(identifier);
			if (!user) return null;
			const keys = await ctx.getActorKeyPairs(identifier);
			return new Person({
				id: ctx.getActorUri(identifier),
				preferredUsername: identifier,
				name: user.displayName ?? identifier,
				summary: user.bio || null,
				url: new URL(`/users/${identifier}`, config.ORIGIN),
				inbox: ctx.getInboxUri(identifier),
				endpoints: new Endpoints({ sharedInbox: ctx.getInboxUri() }),
				followers: ctx.getFollowersUri(identifier),
				publicKey: keys[0]?.cryptographicKey,
				assertionMethods: keys.map((key) => key.multikey)
			});
		})
		.setKeyPairsDispatcher(async (_ctx, identifier) => {
			const user = await actorUser(identifier);
			if (!user) return [];
			const stored = await ensureKeyPairs(user.id, user.keyPairs);
			return Promise.all(
				stored.map(async (pair) => ({
					publicKey: await importJwk(pair.publicKey, 'public'),
					privateKey: await importJwk(pair.privateKey, 'private')
				}))
			);
		});

	fed
		.setFollowersDispatcher('/users/{identifier}/followers', async (_ctx, identifier) => {
			const user = await actorUser(identifier);
			if (!user) return null;
			const rows = await db.select().from(followers).where(eq(followers.userId, user.id));
			const items: Recipient[] = rows.map((row) => ({
				id: new URL(row.actorUri),
				inboxId: new URL(row.inboxUri),
				endpoints: row.sharedInboxUri ? { sharedInbox: new URL(row.sharedInboxUri) } : null
			}));
			return { items };
		})
		.setCounter(async (_ctx, identifier) => {
			const user = await actorUser(identifier);
			if (!user) return 0;
			const [row] = await db
				.select({ value: count() })
				.from(followers)
				.where(eq(followers.userId, user.id));
			return row?.value ?? 0;
		});

	fed
		.setInboxListeners('/users/{identifier}/inbox', '/inbox')
		.on(Follow, async (ctx, follow) => {
			if (!follow.id || !follow.objectId) return;
			const parsed = ctx.parseUri(follow.objectId);
			if (parsed?.type !== 'actor') return;
			const user = await actorUser(parsed.identifier);
			if (!user) return;
			const follower = await follow.getActor(ctx);
			if (!isActor(follower) || !follower.id || !follower.inboxId) return;
			await db
				.insert(followers)
				.values({
					id: newId(),
					userId: user.id,
					actorUri: follower.id.href,
					inboxUri: follower.inboxId.href,
					sharedInboxUri: follower.endpoints?.sharedInbox?.href ?? null
				})
				.onConflictDoNothing();
			await ctx.sendActivity(
				{ identifier: parsed.identifier },
				follower,
				new Accept({
					id: new URL(`#accepts/${crypto.randomUUID()}`, ctx.getActorUri(parsed.identifier)),
					actor: ctx.getActorUri(parsed.identifier),
					object: follow
				})
			);
		})
		.on(Undo, async (ctx, undo) => {
			const object = await undo.getObject(ctx);
			if (!(object instanceof Follow) || !undo.actorId || !object.objectId) return;
			const parsed = ctx.parseUri(object.objectId);
			if (parsed?.type !== 'actor') return;
			const user = await actorUser(parsed.identifier);
			if (!user) return;
			await db
				.delete(followers)
				.where(and(eq(followers.userId, user.id), eq(followers.actorUri, undo.actorId.href)));
		});

	fed.setNodeInfoDispatcher('/nodeinfo/2.1', async () => {
		const [userRow] = await db.select({ value: count() }).from(users);
		const [projectRow] = await db
			.select({ value: count() })
			.from(projects)
			.where(eq(projects.visibility, 'public'));
		return {
			software: { name: 'abwww', version: '0.1.0' },
			protocols: ['activitypub'],
			openRegistrations: config.REGISTRATION === 'open',
			usage: {
				users: { total: userRow?.value ?? 0 },
				localPosts: projectRow?.value ?? 0,
				localComments: 0
			},
			metadata: { nodeName: config.SITE_NAME }
		};
	});
}

/** Tells followers about a project that just went public. Quietly does nothing when federation is off. */
export async function announceSharedProject(
	project: Project,
	owner: { username: string }
): Promise<void> {
	if (!config.FEDERATION) return;
	const ctx = federation.createContext(new URL(config.ORIGIN), undefined);
	const actor = ctx.getActorUri(owner.username);
	const pageUrl = new URL(`/projects/${project.id}`, config.ORIGIN);
	const note = new Note({
		id: new URL(`/projects/${project.id}#note`, config.ORIGIN),
		attribution: actor,
		to: PUBLIC_COLLECTION,
		cc: ctx.getFollowersUri(owner.username),
		url: pageUrl,
		name: project.title,
		content: `<p>${escapeHtml(owner.username)} shared a project: <a href="${pageUrl.href}">${escapeHtml(project.title)}</a></p>`
	});
	await ctx.sendActivity(
		{ identifier: owner.username },
		'followers',
		new Create({
			id: new URL(`/projects/${project.id}#create`, config.ORIGIN),
			actor,
			to: PUBLIC_COLLECTION,
			cc: ctx.getFollowersUri(owner.username),
			object: note
		})
	);
}
