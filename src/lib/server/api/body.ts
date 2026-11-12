import { error } from '@sveltejs/kit';
import { config } from '../config.js';

/** Reads a request body that must fit in `limit` bytes, refusing early when the headers say more. */
export async function readLimitedBody(
	request: Request,
	limit: number,
	what: string
): Promise<Uint8Array> {
	const length = Number(request.headers.get('content-length'));
	if (length > limit) error(413, `${what} can be at most ${limit} bytes`);
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.byteLength > limit) error(413, `${what} can be at most ${limit} bytes`);
	return bytes;
}

export function readProjectJsonBody(request: Request): Promise<Uint8Array> {
	return readLimitedBody(request, config.PROJECT_JSON_MAX_BYTES, 'project.json');
}
