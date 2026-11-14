import { describe, expect, test } from 'bun:test';
import { kv } from '../platform/kv.js';
import { ValkeyKvStore } from './kv.js';
import { ValkeyMessageQueue } from './queue.js';

/** Orders listed `[key, value]` entries by their key path. */
const byKey = (a: unknown, b: unknown) =>
	(a as [string[]])[0].join('/').localeCompare((b as [string[]])[0].join('/'));
const prefix = `test:${crypto.randomUUID()}:`;

describe('ValkeyKvStore', () => {
	const store = new ValkeyKvStore(kv, prefix);

	test('gets, sets, deletes and lists by prefix', async () => {
		await store.set(['a'], { n: 1 });
		await store.set(['a', 'b'], 'child');
		await store.set(['ab'], 'sibling');
		expect(await store.get(['a'])).toEqual({ n: 1 });
		expect(await store.get(['missing'])).toBeUndefined();

		const listed: unknown[] = [];
		for await (const entry of store.list(['a'])) listed.push([entry.key, entry.value]);
		expect(listed.toSorted(byKey)).toEqual([
			[['a'], { n: 1 }],
			[['a', 'b'], 'child']
		]);

		await store.delete(['a']);
		expect(await store.get(['a'])).toBeUndefined();
	});

	test('compare-and-swap only wins when the current value matches', async () => {
		expect(await store.cas(['cas'], undefined, 1)).toBe(true);
		expect(await store.cas(['cas'], undefined, 2)).toBe(false);
		expect(await store.cas(['cas'], 1, 2)).toBe(true);
		expect(await store.get(['cas'])).toBe(2);
	});
});

describe('ValkeyMessageQueue', () => {
	test('delivers ready messages in order and delayed ones when due', async () => {
		const queue = new ValkeyMessageQueue(kv, `${prefix}queue`);
		await queue.enqueue({ n: 1 });
		await queue.enqueue({ n: 2 });
		await queue.enqueue({ n: 3 }, { delay: Temporal.Duration.from({ milliseconds: 300 }) });
		expect(await queue.getDepth()).toEqual({ queued: 3, ready: 2, delayed: 1 });

		const received: unknown[] = [];
		const controller = new AbortController();
		const done = queue.listen(
			(message) => {
				received.push(message);
				if (received.length === 3) controller.abort();
			},
			{ signal: controller.signal }
		);
		await done;
		expect(received).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
	});
});
