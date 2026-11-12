import { strToU8, unzipSync, zipSync } from 'fflate';
import { parseMd5Ext } from '../assets/store.js';
import { config } from '../config.js';
import { InvalidProjectError } from './validate.js';

/**
 * .sb3 files are zip archives holding project.json and one file per asset, named by md5ext.
 * Bun has no zip API (Bun.Archive is tar only), so fflate does the work.
 */

export interface UnpackedSb3 {
	projectJson: Uint8Array;
	/** Asset bytes by md5ext. Entries with other names are dropped. */
	assets: Map<string, Uint8Array>;
}

export function unpackSb3(bytes: Uint8Array): UnpackedSb3 {
	if (bytes.byteLength > config.SB3_MAX_BYTES) {
		throw new InvalidProjectError(`Project files can be at most ${config.SB3_MAX_BYTES} bytes`);
	}
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes, {
			filter: (file) => {
				// The central directory says how big each entry is before anything is inflated,
				// which is where zip bombs get stopped.
				if (file.name === 'project.json') {
					if (file.originalSize > config.PROJECT_JSON_MAX_BYTES) {
						throw new InvalidProjectError(
							`project.json can be at most ${config.PROJECT_JSON_MAX_BYTES} bytes`
						);
					}
					return true;
				}
				if (!parseMd5Ext(file.name)) return false;
				if (file.originalSize > config.ASSET_MAX_BYTES) {
					throw new InvalidProjectError(
						`Asset ${file.name} is larger than ${config.ASSET_MAX_BYTES} bytes`
					);
				}
				return true;
			}
		});
	} catch (error) {
		if (error instanceof InvalidProjectError) throw error;
		throw new InvalidProjectError('That file is not a valid .sb3 (zip) archive');
	}
	const projectJson = files['project.json'];
	if (!projectJson) throw new InvalidProjectError('The archive has no project.json');
	const assets = new Map<string, Uint8Array>();
	for (const [name, data] of Object.entries(files)) {
		if (name !== 'project.json') assets.set(name, data);
	}
	return { projectJson, assets };
}

/** Builds an .sb3. Assets are stored already compressed in their own formats, so they go in as is. */
export function packSb3(projectJson: string, assets: Map<string, Uint8Array>): Uint8Array {
	const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
		'project.json': strToU8(projectJson)
	};
	for (const [name, data] of assets) entries[name] = [data, { level: 0 }];
	return zipSync(entries, { level: 6 });
}
