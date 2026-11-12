import { error } from '@sveltejs/kit';
import { AssetError } from '../assets/store.js';
import { ProjectError } from '../projects/service.js';
import { InvalidProjectError } from '../projects/validate.js';
import { ScratchApiError } from '../scratch/client.js';
import { VerificationError } from '../scratch/verify.js';

/** Turns the domain errors into HTTP errors with their status; anything else is a 500. */
export function throwHttpError(err: unknown): never {
	if (
		err instanceof ProjectError ||
		err instanceof AssetError ||
		err instanceof VerificationError
	) {
		error(err.status, err.message);
	}
	if (err instanceof InvalidProjectError) error(400, err.message);
	if (err instanceof ScratchApiError) {
		error(err.status === 404 ? 404 : 502, `Scratch did not answer as expected: ${err.message}`);
	}
	throw err;
}

/** Runs `fn` and converts known failures into HTTP errors. */
export async function mapErrors<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		throwHttpError(err);
	}
}
