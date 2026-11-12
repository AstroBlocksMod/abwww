import type { PageServerLoad } from './$types';
import { listRecentlyShared } from '#lib/server/projects/service.js';

export const load: PageServerLoad = async () => ({
	projects: await listRecentlyShared(48)
});
