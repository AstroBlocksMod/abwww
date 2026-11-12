import type { LayoutServerLoad } from './$types';
import { config } from '#lib/server/config.js';
import { editorInstalled } from '#lib/server/editor.js';
import { blankEditorUrl } from '#lib/server/projects/urls.js';

export const load: LayoutServerLoad = async ({ locals }) => ({
	user: locals.user,
	siteName: config.SITE_NAME,
	registrationOpen: config.REGISTRATION === 'open',
	newProjectUrl: blankEditorUrl(),
	// Only meaningful when the editor is served by this instance; a remote EDITOR_URL is trusted.
	editorInstalled: config.EDITOR_URL ? true : await editorInstalled()
});
