import { z } from 'zod';
import { lazy } from './platform/lazy.js';

/**
 * Every setting the server reads, in one place. Values come from environment variables, which
 * Bun also loads from `.env` files. Development has defaults for everything so `bun run dev`
 * works against the compose services; production has to set the few that identify the instance.
 */

const production = process.env.NODE_ENV === 'production';

const byteCount = z.coerce.number().int().positive();

const schema = z.object({
	/** Public URL of this instance, without a trailing slash. Also the ActivityPub origin. */
	ORIGIN: production ? z.url() : z.url().default('http://localhost:5173'),
	SITE_NAME: z.string().min(1).default('AstroBlocks'),

	DATABASE_URL: production
		? z.string().min(1)
		: z.string().min(1).default('postgres://abwww:abwww@localhost:5432/abwww'),
	VALKEY_URL: z.string().min(1).default('redis://localhost:6379'),

	/** Where assets and project git repositories live. Must persist between restarts. */
	DATA_DIR: z.string().min(1).default('./data'),

	/** Directory holding the editor's static build (editor.html, embed.html, ...). */
	EDITOR_DIR: z.string().min(1).default('./editor'),
	/**
	 * Base URL the editor is served from. Give it its own origin in production, so that custom
	 * extensions running inside the editor never share an origin with the site's session cookie.
	 * Defaults to `${ORIGIN}/editor`.
	 */
	EDITOR_URL: z.url().optional(),

	/** The Scratch project whose comments are checked for verification codes. */
	SCRATCH_VERIFY_PROJECT_ID: z.coerce.number().int().positive().optional(),
	SCRATCH_VERIFY_PROJECT_OWNER: z.string().min(1).optional(),
	/** Contact information added to the User-Agent sent to Scratch, so they can reach us. */
	SCRATCH_CONTACT: z.string().optional(),

	PROJECT_JSON_MAX_BYTES: byteCount.default(20 * 1024 * 1024),
	ASSET_MAX_BYTES: byteCount.default(25 * 1024 * 1024),
	SB3_MAX_BYTES: byteCount.default(200 * 1024 * 1024),

	SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
	REGISTRATION: z.enum(['open', 'closed']).default('open'),
	FEDERATION: z.stringbool().default(true),
	MIGRATIONS_DIR: z.string().min(1).default('drizzle')
});

export type Config = z.infer<typeof schema> & {
	readonly editorUrl: string;
	readonly scratchVerification: { projectId: number; owner: string } | null;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	const result = schema.safeParse(env);
	if (!result.success) {
		const lines = result.error.issues.map(
			(issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`
		);
		throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
	}
	const values = result.data;
	const origin = values.ORIGIN.replace(/\/+$/, '');
	const scratchVerification =
		values.SCRATCH_VERIFY_PROJECT_ID && values.SCRATCH_VERIFY_PROJECT_OWNER
			? { projectId: values.SCRATCH_VERIFY_PROJECT_ID, owner: values.SCRATCH_VERIFY_PROJECT_OWNER }
			: null;
	return {
		...values,
		ORIGIN: origin,
		editorUrl: (values.EDITOR_URL ?? `${origin}/editor`).replace(/\/+$/, ''),
		scratchVerification
	};
}

/** Loaded on first use, not at import, so building the app needs no environment. */
export const config: Config = lazy(() => loadConfig());
