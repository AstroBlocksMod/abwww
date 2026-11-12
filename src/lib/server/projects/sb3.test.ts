import { describe, expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { backdropMd5Ext, backdropSvg, minimalProjectJson } from './fixtures.js';
import { packSb3, unpackSb3 } from './sb3.js';
import { InvalidProjectError, parseProjectJson, referencedAssets } from './validate.js';

describe('sb3', () => {
	test('packs and unpacks project.json with its assets', () => {
		const json = minimalProjectJson();
		const packed = packSb3(json, new Map([[backdropMd5Ext, backdropSvg]]));
		const unpacked = unpackSb3(packed);
		expect(new TextDecoder().decode(unpacked.projectJson)).toBe(json);
		expect([...unpacked.assets.keys()]).toEqual([backdropMd5Ext]);
		expect(unpacked.assets.get(backdropMd5Ext)).toEqual(backdropSvg);
	});

	test('drops entries that are not project.json or an md5ext name', () => {
		const packed = zipSync({
			'project.json': strToU8(minimalProjectJson()),
			'../escape.svg': strToU8('<svg/>'),
			'notes.txt': strToU8('hello'),
			[backdropMd5Ext]: backdropSvg
		});
		const unpacked = unpackSb3(packed);
		expect([...unpacked.assets.keys()]).toEqual([backdropMd5Ext]);
	});

	test('rejects archives without project.json and things that are not zips', () => {
		expect(() => unpackSb3(zipSync({ 'a.txt': strToU8('x') }))).toThrow(InvalidProjectError);
		expect(() => unpackSb3(new Uint8Array([1, 2, 3]))).toThrow(InvalidProjectError);
	});
});

describe('validate', () => {
	test('accepts a minimal project and lists its assets', () => {
		const project = parseProjectJson(minimalProjectJson());
		expect([...referencedAssets(project)]).toEqual([backdropMd5Ext]);
	});

	test('falls back to assetId plus dataFormat when md5ext is missing', () => {
		const raw = JSON.parse(minimalProjectJson()) as {
			targets: { costumes: { md5ext?: string }[] }[];
		};
		delete raw.targets[0]!.costumes[0]!.md5ext;
		expect([...referencedAssets(parseProjectJson(JSON.stringify(raw)))]).toEqual([backdropMd5Ext]);
	});

	test('rejects projects without a stage or with bad JSON', () => {
		expect(() => parseProjectJson('{')).toThrow(InvalidProjectError);
		expect(() => parseProjectJson('{"targets":[],"meta":{"semver":"3.0.0"}}')).toThrow(
			InvalidProjectError
		);
		const noStage = minimalProjectJson().replace('"isStage":true', '"isStage":false');
		expect(() => parseProjectJson(noStage)).toThrow(InvalidProjectError);
	});
});
