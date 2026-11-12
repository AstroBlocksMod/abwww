import { exportJwk, generateCryptoKeyPair } from '@fedify/fedify';
import { eq, sql } from 'drizzle-orm';
import { users, type StoredKeyPair } from '../db/schema/index.js';
import { db } from '../platform/db.js';

/**
 * Every actor signs with an RSA key (what most of the fediverse checks) and an Ed25519 key (the
 * newer standard). Keys are made when the account is, so nothing ever signs with a key that is
 * about to be replaced.
 */
export async function generateKeyPairs(): Promise<StoredKeyPair[]> {
	const pairs: StoredKeyPair[] = [];
	for (const algorithm of ['RSASSA-PKCS1-v1_5', 'Ed25519'] as const) {
		const pair = await generateCryptoKeyPair(algorithm);
		pairs.push({
			algorithm,
			publicKey: await exportJwk(pair.publicKey),
			privateKey: await exportJwk(pair.privateKey)
		});
	}
	return pairs;
}

/**
 * For accounts that somehow have no keys: stores a fresh set only if the row is still empty, and
 * returns whatever the row holds afterwards, so two concurrent callers agree on one set.
 */
export async function ensureKeyPairs(
	userId: string,
	current: StoredKeyPair[]
): Promise<StoredKeyPair[]> {
	if (current.length > 0) return current;
	const fresh = await generateKeyPairs();
	const [row] = await db
		.update(users)
		.set({ keyPairs: fresh })
		.where(sql`${users.id} = ${userId} and ${users.keyPairs} = '[]'::jsonb`)
		.returning({ keyPairs: users.keyPairs });
	if (row) return row.keyPairs;
	const [existing] = await db
		.select({ keyPairs: users.keyPairs })
		.from(users)
		.where(eq(users.id, userId));
	return existing?.keyPairs ?? [];
}
