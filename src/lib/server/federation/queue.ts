import type {
	MessageQueue,
	MessageQueueDepth,
	MessageQueueEnqueueOptions,
	MessageQueueListenOptions
} from '@fedify/fedify';
import type { RedisClient } from 'bun';

/**
 * Fedify's outgoing and incoming work queue on Valkey: a list for messages that are ready and a
 * sorted set, scored by due time, for delayed ones. One consumer per process takes messages in
 * order, which also keeps Fedify's ordering keys honored.
 */
export class ValkeyMessageQueue implements MessageQueue {
	readonly nativeRetrial = false;
	private readonly ready: string;
	private readonly delayed: string;

	constructor(
		private readonly client: RedisClient,
		prefix = 'fedify:queue'
	) {
		this.ready = `${prefix}:ready`;
		this.delayed = `${prefix}:delayed`;
	}

	async enqueue(message: unknown, options?: MessageQueueEnqueueOptions): Promise<void> {
		const body = JSON.stringify({ message, nonce: crypto.randomUUID() });
		const delay = options?.delay ? options.delay.total('millisecond') : 0;
		if (delay > 0) {
			await this.client.send('ZADD', [this.delayed, String(Date.now() + delay), body]);
		} else {
			await this.client.send('RPUSH', [this.ready, body]);
		}
	}

	async getDepth(): Promise<MessageQueueDepth> {
		const [ready, delayed] = await Promise.all([
			this.client.send('LLEN', [this.ready]),
			this.client.send('ZCARD', [this.delayed])
		]);
		return {
			queued: Number(ready) + Number(delayed),
			ready: Number(ready),
			delayed: Number(delayed)
		};
	}

	/** Moves every delayed message whose time has come onto the ready list, atomically. */
	private async promoteDue(): Promise<void> {
		const script = `
			local due = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 100)
			for _, body in ipairs(due) do
				redis.call('ZREM', KEYS[1], body)
				redis.call('RPUSH', KEYS[2], body)
			end
			return #due`;
		await this.client.send('EVAL', [script, '2', this.delayed, this.ready, String(Date.now())]);
	}

	async listen(
		handler: (message: unknown) => Promise<void> | void,
		options: MessageQueueListenOptions = {}
	): Promise<void> {
		const { signal } = options;
		const stopped = () => signal?.aborted === true;
		while (!stopped()) {
			let body: string | null = null;
			try {
				await this.promoteDue();
				body = (await this.client.send('LPOP', [this.ready])) as string | null;
			} catch (error) {
				console.error('Message queue poll failed:', error);
			}
			if (body === null) {
				await sleep(500, signal);
				continue;
			}
			try {
				const { message } = JSON.parse(body) as { message: unknown };
				await handler(message);
			} catch (error) {
				console.error('Message handler failed:', error);
			}
		}
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(done, ms);
		function done() {
			signal?.removeEventListener('abort', done);
			clearTimeout(timer);
			resolve();
		}
		signal?.addEventListener('abort', done, { once: true });
	});
}
