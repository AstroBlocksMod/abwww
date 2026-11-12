import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiCaller } from '#lib/server/api/auth.js';
import { readLimitedBody } from '#lib/server/api/body.js';
import { mapErrors } from '#lib/server/api/errors.js';
import { stageAsset } from '#lib/server/assets/staging.js';
import { isAllowedFormat, parseMd5Ext, storeAsset } from '#lib/server/assets/store.js';
import { config } from '#lib/server/config.js';
import { enforceRateLimit } from '#lib/server/ratelimit.js';

/**
 * Uploads one asset ahead of a save, named by its md5 the way the editor does it. The bytes are
 * hashed and stored by sha256; the md5 name is only checked against the content and remembered
 * for the user's next save.
 */
export const POST: RequestHandler = async (event) => {
	const parsed = parseMd5Ext(event.params.md5ext);
	if (!parsed || !isAllowedFormat(parsed.format))
		error(400, 'Asset names look like <md5>.<png|svg|wav|mp3|...>');
	const caller = await requireApiCaller(event);
	await enforceRateLimit('asset-upload', caller.actor.id, 3000, 60 * 60);

	const bytes = await readLimitedBody(event.request, config.ASSET_MAX_BYTES, 'An asset');
	const stored = await mapErrors(() => storeAsset(bytes, parsed.md5));
	await stageAsset(caller.actor.id, event.params.md5ext, stored.sha256);
	return Response.json({
		status: 'ok',
		'content-name': event.params.md5ext,
		sha256: stored.sha256
	});
};
