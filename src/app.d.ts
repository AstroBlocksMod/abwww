import type { SessionUser } from '#lib/server/auth/sessions.js';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in user, or null for a guest. Set in hooks.server.ts. */
			user: SessionUser | null;
			/** The session id behind `user`, so actions can refresh or destroy it. */
			sessionId: string | null;
		}
		interface Error {
			status: number;
			message: string;
		}
	}
}

export {};
