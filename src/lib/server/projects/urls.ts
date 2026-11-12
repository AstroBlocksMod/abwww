import { config } from '../config.js';

/**
 * The editor loads a project from any URL passed as `project_url`. We hand it the .sb3, which
 * carries the assets, so the unmodified editor build needs no asset host of ours. Private
 * projects get a token on that URL, which the owner's page mints.
 */

export function projectJsonUrl(
	projectId: number,
	token?: string | null,
	version?: string | null
): string {
	const url = new URL(`/api/projects/${projectId}`, config.ORIGIN);
	if (token) url.searchParams.set('token', token);
	if (version) url.searchParams.set('version', version);
	return url.href;
}

export function projectSb3Url(
	projectId: number,
	token?: string | null,
	version?: string | null
): string {
	const url = new URL(`/api/projects/${projectId}/sb3`, config.ORIGIN);
	if (token) url.searchParams.set('token', token);
	if (version) url.searchParams.set('version', version);
	return url.href;
}

/** The embeddable player for a project. */
export function playerUrl(
	projectId: number,
	options: { token?: string | null; version?: string | null } = {}
): string {
	const url = new URL(`${config.editorUrl}/embed.html`);
	url.searchParams.set('project_url', projectSb3Url(projectId, options.token, options.version));
	url.searchParams.set('autoplay', '');
	url.hash = '0';
	return url.href;
}

/** The full editor, opened on a project ("See inside"). */
export function editorUrl(
	projectId: number,
	title: string,
	options: { token?: string | null; version?: string | null } = {}
): string {
	const url = new URL(`${config.editorUrl}/editor.html`);
	url.searchParams.set('project_url', projectSb3Url(projectId, options.token, options.version));
	url.searchParams.set('project_title', title);
	url.hash = '0';
	return url.href;
}

/** The editor with nothing loaded, for starting something new. */
export function blankEditorUrl(): string {
	return `${config.editorUrl}/editor.html`;
}
