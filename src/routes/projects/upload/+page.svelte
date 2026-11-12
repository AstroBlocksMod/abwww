<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const maxMiB = $derived(Math.round(data.maxBytes / 1024 / 1024));
</script>

<svelte:head>
	<title>Upload a project</title>
</svelte:head>

<h1>Upload a project</h1>

<form method="post" enctype="multipart/form-data" class="stack card" style="max-width: 32rem">
	{#if form?.error}
		<p class="notice error">{form.error}</p>
	{/if}
	<p class="muted">
		Any .sb3 works: one saved from the editor here, from Scratch, or from TurboWarp. Up to {maxMiB}
		MiB. It starts out private.
	</p>
	<label>
		Project file
		<input
			type="file"
			name="file"
			accept=".sb3,application/x.scratch.sb3,application/zip"
			required
		/>
	</label>
	<label>
		Title (optional, the file name is used otherwise)
		<input type="text" name="title" maxlength="100" />
	</label>
	<div><button type="submit">Upload</button></div>
</form>
