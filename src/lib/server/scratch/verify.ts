import { eq, sql } from 'drizzle-orm';
import { findUserById } from '../auth/users.js';
import { config } from '../config.js';
import { users } from '../db/schema/index.js';
import { db, isUniqueViolation } from '../platform/db.js';
import { humanCode } from '../platform/ids.js';
import { kvDelete, kvGetJson, kvSetJson } from '../platform/kv.js';
import { enforceRateLimit } from '../ratelimit.js';
import { getProjectComments } from './client.js';

/**
 * Proving you own a Scratch account: we hand out a code, you post it as a comment on the
 * verification project, we read the comments and check the author. No passwords involved.
 */

const CODE_TTL_SECONDS = 15 * 60;
const key = (userId: string) => `scratch-verify:${userId}`;

export interface PendingVerification {
	code: string;
	scratchUsername: string;
	createdAt: number;
}

export interface VerificationTarget {
	projectId: number;
	owner: string;
	url: string;
}

export function verificationTarget(): VerificationTarget | null {
	const target = config.scratchVerification;
	if (!target) return null;
	return { ...target, url: `https://scratch.mit.edu/projects/${target.projectId}/` };
}

export const scratchUsernamePattern = /^[A-Za-z0-9_-]{3,20}$/;

export class VerificationError extends Error {
	constructor(
		readonly status: 400 | 409 | 503,
		message: string
	) {
		super(message);
	}
}

export async function startVerification(
	userId: string,
	scratchUsername: string
): Promise<PendingVerification> {
	if (!verificationTarget()) {
		throw new VerificationError(503, 'Scratch account linking is not set up on this instance');
	}
	if (!scratchUsernamePattern.test(scratchUsername)) {
		throw new VerificationError(400, 'That is not a valid Scratch username');
	}
	await enforceRateLimit('scratch-verify-start', userId, 10, 60 * 60);
	await enforceRateLimit('scratch-verify-target', scratchUsername.toLowerCase(), 10, 60 * 60);
	const pending: PendingVerification = {
		code: `abwww-${humanCode(8)}`,
		scratchUsername,
		createdAt: Date.now()
	};
	await kvSetJson(key(userId), pending, CODE_TTL_SECONDS);
	return pending;
}

export async function pendingVerification(userId: string): Promise<PendingVerification | null> {
	return kvGetJson<PendingVerification>(key(userId));
}

export async function cancelVerification(userId: string): Promise<void> {
	await kvDelete(key(userId));
}

export type CheckResult = 'linked' | 'not-found' | 'expired' | 'taken';

/** Looks for the pending code among the newest comments and links the account when it is there. */
export async function checkVerification(userId: string): Promise<CheckResult> {
	const target = verificationTarget();
	if (!target)
		throw new VerificationError(503, 'Scratch account linking is not set up on this instance');
	const pending = await pendingVerification(userId);
	if (!pending) return 'expired';
	await enforceRateLimit('scratch-verify-check', userId, 12, 60);
	await enforceRateLimit(
		'scratch-verify-check-target',
		pending.scratchUsername.toLowerCase(),
		30,
		60
	);

	const comments = await getProjectComments(target.owner, target.projectId, 40);
	const wanted = pending.scratchUsername.toLowerCase();
	const found = comments.find(
		(comment) =>
			comment.author.username.toLowerCase() === wanted && comment.content.includes(pending.code)
	);
	if (!found) return 'not-found';

	// The comment author's exact spelling is what we store; the uniqueness check ignores case,
	// like the index does.
	const scratchUsername = found.author.username;
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(sql`lower(${users.scratchUsername})`, scratchUsername.toLowerCase()))
		.limit(1);
	if (existing[0] && existing[0].id !== userId) return 'taken';

	try {
		await db
			.update(users)
			.set({ scratchUsername, scratchLinkedAt: new Date() })
			.where(eq(users.id, userId));
	} catch (error) {
		// Two people verifying the same account at once: the unique index settles it.
		if (isUniqueViolation(error)) return 'taken';
		throw error;
	}
	await cancelVerification(userId);
	return 'linked';
}

export async function unlinkScratch(userId: string): Promise<void> {
	const user = await findUserById(userId);
	if (!user) return;
	await db
		.update(users)
		.set({ scratchUsername: null, scratchLinkedAt: null })
		.where(eq(users.id, userId));
}
