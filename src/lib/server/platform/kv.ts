import { RedisClient } from 'bun';
import { config } from '../config.js';
import { lazy } from './lazy.js';

/**
 * Valkey access. Everything that must outlive a request but is not a record (sessions, codes,
 * rate limits, caches, queues) goes through here.
 */
export const kv: RedisClient = lazy(() => new RedisClient(config.VALKEY_URL));

export async function kvGetJson<T>(key: string): Promise<T | null> {
	const raw = await kv.get(key);
	return raw === null ? null : (JSON.parse(raw) as T);
}

/** Stores a JSON value, with an expiry in seconds when given. One round trip, so it is atomic. */
export async function kvSetJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
	const args = [key, JSON.stringify(value)];
	if (ttlSeconds !== undefined) args.push('EX', String(Math.max(1, Math.ceil(ttlSeconds))));
	await kv.send('SET', args);
}

/** Like SET NX: stores the value only if the key is absent. Returns whether it was stored. */
export async function kvSetJsonIfAbsent(
	key: string,
	value: unknown,
	ttlSeconds: number
): Promise<boolean> {
	const reply = await kv.send('SET', [
		key,
		JSON.stringify(value),
		'NX',
		'EX',
		String(Math.max(1, Math.ceil(ttlSeconds)))
	]);
	return reply === 'OK';
}

export async function kvDelete(...keys: string[]): Promise<void> {
	if (keys.length > 0) await kv.del(...keys);
}

/**
 * Increments a counter that expires `windowSeconds` after it was created. Returns the new count.
 * One Lua call, so a counter can never be left behind without an expiry.
 */
export async function kvIncrementWindow(key: string, windowSeconds: number): Promise<number> {
	const script = `
		local count = redis.call('INCR', KEYS[1])
		if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
		return count`;
	return Number(await kv.send('EVAL', [script, '1', key, String(windowSeconds)]));
}

/** Iterates keys matching a glob pattern with SCAN, so large keyspaces are never blocked. */
export async function* kvScan(pattern: string, count = 200): AsyncGenerator<string> {
	let cursor = '0';
	do {
		const reply = (await kv.send('SCAN', [cursor, 'MATCH', pattern, 'COUNT', String(count)])) as [
			string,
			string[]
		];
		cursor = reply[0];
		for (const key of reply[1]) yield key;
	} while (cursor !== '0');
}
