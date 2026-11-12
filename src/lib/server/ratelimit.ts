import { error } from '@sveltejs/kit';
import { kvIncrementWindow } from './platform/kv.js';

/**
 * Fixed-window rate limiting in Valkey. `bucket` names the action, `subject` who is doing it
 * (an IP address, a user id, a Scratch username). Throws a 429 when the limit is passed.
 */
export async function enforceRateLimit(
	bucket: string,
	subject: string,
	limit: number,
	windowSeconds: number
): Promise<void> {
	const count = await kvIncrementWindow(`ratelimit:${bucket}:${subject}`, windowSeconds);
	if (count > limit) {
		error(429, 'Too many requests, slow down and try again in a bit');
	}
}
