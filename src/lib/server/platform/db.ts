import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { config } from '../config.js';
import { lazy } from './lazy.js';

/**
 * The one database handle. Drizzle sits on Bun's native Postgres client here; moving to another
 * driver (postgres.js, Neon, Hyperdrive) means changing this file and nothing else.
 */
let client: SQL | null = null;

export const db = lazy(() => {
	client = new SQL(config.DATABASE_URL);
	return drizzle({ client });
});

export type Db = typeof db;

/** Whether an error is PostgreSQL's unique constraint violation (SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === '23505'
	);
}

export async function closeDb(): Promise<void> {
	await client?.close();
	client = null;
}
