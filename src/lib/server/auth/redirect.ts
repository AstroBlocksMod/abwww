/**
 * Where to send someone after signing in. Only paths on this site are followed: browsers read
 * "//evil.com" and "/\evil.com" as other hosts, and the URL parser agrees with them.
 */
export function safeRedirect(target: string | null, origin: string): string {
	if (!target || !target.startsWith('/')) return '/';
	const resolved = new URL(target, origin);
	if (resolved.origin !== origin) return '/';
	return resolved.pathname + resolved.search + resolved.hash;
}
