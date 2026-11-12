import { join } from 'node:path';
import { config } from './config.js';
import { fileExists } from './platform/fs.js';

/**
 * Whether EDITOR_DIR holds an editor build. Checked once per process, so pages can say "the
 * editor is not installed" instead of embedding a frame that cannot load.
 */
let installed: Promise<boolean> | null = null;

export function editorInstalled(): Promise<boolean> {
	installed ??= fileExists(join(config.EDITOR_DIR, 'embed.html'));
	return installed;
}
