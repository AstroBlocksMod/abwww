import { md5Hex } from '../platform/hash.js';

/**
 * A tiny but complete sb3 project for tests: a stage with one backdrop. The backdrop is our own
 * SVG, named by its md5 the way Scratch names assets.
 */
export const backdropSvg = new TextEncoder().encode(
	'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#fff"/></svg>'
);
export const backdropMd5 = md5Hex(backdropSvg);
export const backdropMd5Ext = `${backdropMd5}.svg`;

export function minimalProject(extra: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		targets: [
			{
				isStage: true,
				name: 'Stage',
				variables: {},
				lists: {},
				broadcasts: {},
				blocks: {},
				comments: {},
				currentCostume: 0,
				costumes: [
					{
						name: 'backdrop1',
						dataFormat: 'svg',
						assetId: backdropMd5,
						md5ext: backdropMd5Ext,
						rotationCenterX: 240,
						rotationCenterY: 180
					}
				],
				sounds: [],
				volume: 100,
				layerOrder: 0,
				tempo: 60,
				videoTransparency: 50,
				videoState: 'on',
				textToSpeechLanguage: null
			}
		],
		monitors: [],
		extensions: [],
		meta: { semver: '3.0.0', vm: '0.2.0', agent: 'abwww tests' },
		...extra
	};
}

export function minimalProjectJson(extra: Record<string, unknown> = {}): string {
	return JSON.stringify(minimalProject(extra));
}
