import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { config } from '../config.js';
import { closeDb, db } from '../platform/db.js';

/** Applies every migration in `drizzle/` that has not run yet. Safe to call on every start. */
export async function runMigrations(): Promise<void> {
	const result = await migrate(db, { migrationsFolder: config.MIGRATIONS_DIR });
	if (result && typeof result === 'object' && 'success' in result && result.success === false) {
		throw new Error(`Migrations failed: ${JSON.stringify(result)}`);
	}
}

if (import.meta.main) {
	await runMigrations();
	console.log('Migrations applied.');
	await closeDb();
}
