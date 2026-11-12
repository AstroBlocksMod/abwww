/**
 * Defers creating an object until something touches it. SvelteKit imports server modules while
 * building, so anything that reads configuration or opens a connection at import time would run
 * on the build machine. Behind this, it runs on the first request instead.
 */
export function lazy<T extends object>(create: () => T): T {
	let instance: T | null = null;
	const get = () => (instance ??= create());
	return new Proxy({} as T, {
		get(_, property) {
			const target = get();
			const value = Reflect.get(target, property, target);
			// Native-backed classes check `this`, so methods must see the real object, never the proxy.
			return typeof value === 'function' ? value.bind(target) : value;
		},
		has(_, property) {
			return Reflect.has(get(), property);
		},
		ownKeys() {
			return Reflect.ownKeys(get());
		},
		getOwnPropertyDescriptor(_, property) {
			const descriptor = Reflect.getOwnPropertyDescriptor(get(), property);
			return descriptor ? { ...descriptor, configurable: true } : undefined;
		}
	});
}
