import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { users, type User } from '../db/schema/index.js';
import { generateKeyPairs } from '../federation/keys.js';
import { db, isUniqueViolation } from '../platform/db.js';
import { newId } from '../platform/ids.js';
import { hashPassword, verifyPassword } from '../platform/password.js';

/** Same rules as Scratch: 3 to 20 characters, letters, digits, hyphens and underscores. */
export const usernameSchema = z
	.string()
	.trim()
	.min(3, 'Usernames need at least 3 characters')
	.max(20, 'Usernames can have at most 20 characters')
	.regex(/^[A-Za-z0-9_-]+$/, 'Only letters, digits, - and _ are allowed');

export const passwordSchema = z
	.string()
	.min(8, 'Passwords need at least 8 characters')
	.max(512, 'That password is too long');

export type PublicUser = Pick<
	User,
	'id' | 'username' | 'displayName' | 'bio' | 'scratchUsername' | 'createdAt'
>;

export function toPublicUser(user: User): PublicUser {
	return {
		id: user.id,
		username: user.username,
		displayName: user.displayName,
		bio: user.bio,
		scratchUsername: user.scratchUsername,
		createdAt: user.createdAt
	};
}

export async function findUserByUsername(username: string): Promise<User | null> {
	const rows = await db
		.select()
		.from(users)
		.where(eq(sql`lower(${users.username})`, username.toLowerCase()))
		.limit(1);
	return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return rows[0] ?? null;
}

export class UsernameTakenError extends Error {
	constructor() {
		super('That username is taken');
	}
}

export async function registerUser(username: string, password: string): Promise<User> {
	if (await findUserByUsername(username)) throw new UsernameTakenError();
	const [passwordHash, keyPairs] = await Promise.all([hashPassword(password), generateKeyPairs()]);
	try {
		const [user] = await db
			.insert(users)
			.values({ id: newId(), username, passwordHash, keyPairs })
			.returning();
		if (!user) throw new Error('Insert returned no row');
		return user;
	} catch (error) {
		// Two registrations of the same name at once: the unique index decides.
		if (isUniqueViolation(error)) throw new UsernameTakenError();
		throw error;
	}
}

/** Null on a bad username or password. Takes the same time either way, so names cannot be probed. */
export async function authenticate(username: string, password: string): Promise<User | null> {
	const user = await findUserByUsername(username);
	// Verifying against a dummy hash keeps the timing the same for unknown names.
	const hash = user?.passwordHash ?? DUMMY_HASH;
	const ok = await verifyPassword(password, hash);
	return ok && user ? user : null;
}

const DUMMY_HASH =
	'$argon2id$v=19$m=65536,t=2,p=1$3aXaAzz8oA1VY0bVkqXlfWcdE6kG4L0e3mEbbN4Y2Dk$1RBtR2Pq5dF9uSduP2iyNmmV4m2Bd9fGkTbYPAHbSJc';

export async function updateProfile(
	id: string,
	patch: { displayName?: string | null; bio?: string }
): Promise<void> {
	await db.update(users).set(patch).where(eq(users.id, id));
}
