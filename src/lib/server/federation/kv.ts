import type { KvKey, KvStore, KvStoreListEntry, KvStoreSetOptions } from '@fedify/fedify';
import type { RedisClient } from 'bun';
import { kvScan } from '../platform/kv.js';

/**
 * Fedify's key-value store on Bun's Valkey client, so Fedify shares our connection instead of
 * bringing ioredis along. Keys are path-like strings; values are JSON.
 */
export class ValkeyKvStore implements KvStore {
	constructor(
		private readonly client: RedisClient,
		private readonly prefix = 'fedify:kv:'
	) {}

	private serialize(key: KvKey): string {
		return this.prefix + key.map((part) => encodeURIComponent(part)).join('/');
	}

	private deserialize(raw: string): KvKey {
		const parts = raw.slice(this.prefix.length).split('/').map(decodeURIComponent);
		return parts as unknown as KvKey;
	}

	async get<T = unknown>(key: KvKey): Promise<T | undefined> {
		const raw = await this.client.get(this.serialize(key));
		return raw === null ? undefined : (JSON.parse(raw) as T);
	}

	async set(key: KvKey, value: unknown, options?: KvStoreSetOptions): Promise<void> {
		const args = [this.serialize(key), JSON.stringify(value)];
		const ttl = options?.ttl ? Math.ceil(options.ttl.total('millisecond')) : 0;
		if (ttl > 0) args.push('PX', String(ttl));
		await this.client.send('SET', args);
	}

	async delete(key: KvKey): Promise<void> {
		await this.client.del(this.serialize(key));
	}

	/** Compare-and-swap in one Lua call, so two workers cannot both win. */
	async cas(
		key: KvKey,
		expectedValue: unknown,
		newValue: unknown,
		options?: KvStoreSetOptions
	): Promise<boolean> {
		const ttl = options?.ttl ? Math.ceil(options.ttl.total('millisecond')) : 0;
		const script = `
			local current = redis.call('GET', KEYS[1])
			local expected = ARGV[1]
			if (current == false and expected == '') or (current ~= false and expected ~= '' and current == expected) then
				if tonumber(ARGV[3]) > 0 then
					redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
				else
					redis.call('SET', KEYS[1], ARGV[2])
				end
				return 1
			end
			return 0`;
		const result = await this.client.send('EVAL', [
			script,
			'1',
			this.serialize(key),
			expectedValue === undefined ? '' : JSON.stringify(expectedValue),
			JSON.stringify(newValue),
			String(ttl)
		]);
		return Number(result) === 1;
	}

	async *list(prefix?: KvKey): AsyncIterable<KvStoreListEntry> {
		const pattern = prefix ? `${this.serialize(prefix)}*` : `${this.prefix}*`;
		const exact = prefix ? this.serialize(prefix) : null;
		for await (const raw of kvScan(pattern)) {
			// A prefix of ["a"] must not match ["ab"]; only the key itself or children of it.
			if (exact !== null && raw !== exact && !raw.startsWith(`${exact}/`)) continue;
			const value = await this.client.get(raw);
			if (value === null) continue;
			yield { key: this.deserialize(raw), value: JSON.parse(value) };
		}
	}
}
