import { z } from 'zod';
import { parseMd5Ext } from '../assets/store.js';

/**
 * The parts of an sb3 project.json we rely on. Everything else passes through untouched, since
 * the VM is the authority on the rest and extensions add their own fields.
 */
const assetSchema = z.looseObject({
	name: z.string(),
	assetId: z.string().regex(/^[0-9a-f]{32}$/),
	dataFormat: z.string().regex(/^[a-z0-9]{1,8}$/),
	md5ext: z.string().optional()
});

const targetSchema = z.looseObject({
	isStage: z.boolean(),
	name: z.string(),
	costumes: z.array(assetSchema),
	sounds: z.array(assetSchema)
});

export const projectJsonSchema = z.looseObject({
	targets: z.array(targetSchema).min(1),
	meta: z.looseObject({
		semver: z.string(),
		vm: z.string().optional(),
		agent: z.string().optional()
	})
});

export type ProjectJson = z.infer<typeof projectJsonSchema>;

export class InvalidProjectError extends Error {}

export function parseProjectJson(text: string | Uint8Array): ProjectJson {
	let raw: unknown;
	try {
		raw = JSON.parse(typeof text === 'string' ? text : new TextDecoder().decode(text));
	} catch {
		throw new InvalidProjectError('project.json is not valid JSON');
	}
	const result = projectJsonSchema.safeParse(raw);
	if (!result.success) {
		const issue = result.error.issues[0];
		throw new InvalidProjectError(
			`project.json is not an sb3 project: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim()
		);
	}
	if (!result.data.targets.some((t) => t.isStage)) {
		throw new InvalidProjectError('project.json has no stage');
	}
	return result.data;
}

/** Every `md5ext` a project needs, in the form they appear in project.json. */
export function referencedAssets(project: ProjectJson): Set<string> {
	const names = new Set<string>();
	for (const target of project.targets) {
		for (const asset of [...target.costumes, ...target.sounds]) {
			const md5ext = asset.md5ext ?? `${asset.assetId}.${asset.dataFormat}`;
			if (!parseMd5Ext(md5ext)) {
				throw new InvalidProjectError(`Asset "${asset.name}" has an invalid name: ${md5ext}`);
			}
			names.add(md5ext);
		}
	}
	return names;
}

/** The title a project carries in its own JSON, if any, for uploads that name nothing else. */
export function titleFromProject(project: ProjectJson): string | null {
	const stage = project.targets.find((t) => t.isStage);
	const title = (stage as Record<string, unknown> | undefined)?.['title'];
	return typeof title === 'string' && title.trim() ? title.trim() : null;
}
