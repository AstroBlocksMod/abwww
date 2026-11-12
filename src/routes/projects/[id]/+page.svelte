<script lang="ts">
	import { enhance } from '$app/forms';
	import Player from '#lib/components/Player.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let editing = $state(false);
	let confirmDelete = $state(false);
</script>

<svelte:head>
	<title>{data.project.title}</title>
</svelte:head>

<div class="stack">
	{#if form?.error}
		<p class="notice error">{form.error}</p>
	{/if}
	{#if form?.saved}
		<p class="notice success">Saved.</p>
	{/if}
	{#if data.version}
		<p class="notice">
			You are looking at version <span class="code">{data.version.slice(0, 7)}</span>.
			<a href="/projects/{data.project.id}">Back to the current version</a>
		</p>
	{/if}

	<div class="project-layout">
		<div class="stack">
			<div class="project-heading">
				<h1>{data.project.title}</h1>
				{#if data.owner}
					<span class="muted">
						by <a href="/users/{data.owner.username}"
							>{data.owner.displayName ?? data.owner.username}</a
						>
					</span>
				{/if}
				{#if data.project.visibility !== 'public'}
					<span class="pill">{data.project.visibility}</span>
				{/if}
			</div>

			{#if data.editorInstalled}
				<Player src={data.urls.player} title={data.project.title} />
			{:else}
				<p class="notice">
					The editor is not installed on this instance, so projects cannot be played here yet. You
					can still download the project.
				</p>
			{/if}

			<div class="row">
				<a class="button" href={data.urls.editor} target="_blank" rel="noopener">See inside</a>
				{#if data.canRemix && !data.isOwner}
					<form method="post" action="?/remix">
						<button type="submit" class="secondary">Remix</button>
					</form>
				{/if}
				<a class="button secondary" href={data.urls.download}>Download</a>
				<a class="button secondary" href="/projects/{data.project.id}/history">History</a>
				{#if data.isOwner}
					<button type="button" class="secondary" onclick={() => (editing = !editing)}>
						{editing ? 'Close' : 'Edit details'}
					</button>
				{/if}
			</div>

			{#if data.remixOf}
				<p class="muted">
					Remix of <a href="/projects/{data.remixOf.id}">{data.remixOf.title}</a> by {data.remixOf
						.owner}.
				</p>
			{/if}
			{#if data.project.scratchProjectId}
				<p class="muted">
					Imported from
					<a
						href="https://scratch.mit.edu/projects/{data.project.scratchProjectId}/"
						rel="noopener"
					>
						Scratch project {data.project.scratchProjectId}
					</a>.
				</p>
			{/if}
		</div>

		<aside class="stack">
			<section class="card">
				<h2>Instructions</h2>
				{#if data.project.instructions}
					<pre class="notes">{data.project.instructions}</pre>
				{:else}
					<p class="muted">None yet.</p>
				{/if}
			</section>
			<section class="card">
				<h2>Notes and credits</h2>
				{#if data.project.description}
					<pre class="notes">{data.project.description}</pre>
				{:else}
					<p class="muted">None yet.</p>
				{/if}
			</section>
		</aside>
	</div>

	{#if data.isOwner && editing}
		<section class="card stack">
			<h2>Details</h2>
			<form method="post" action="?/details" class="stack" use:enhance>
				<label>
					Title
					<input type="text" name="title" maxlength="100" required value={data.project.title} />
				</label>
				<label>
					Instructions
					<textarea name="instructions" maxlength="5000">{data.project.instructions}</textarea>
				</label>
				<label>
					Notes and credits
					<textarea name="description" maxlength="5000">{data.project.description}</textarea>
				</label>
				<div><button type="submit">Save details</button></div>
			</form>

			<h2>Sharing</h2>
			<form method="post" action="?/visibility" class="row" use:enhance>
				<select name="visibility">
					<option value="private" selected={data.project.visibility === 'private'}
						>Private (only you)</option
					>
					<option value="unlisted" selected={data.project.visibility === 'unlisted'}
						>Unlisted (anyone with the link)</option
					>
					<option value="public" selected={data.project.visibility === 'public'}
						>Public (listed, announced to followers)</option
					>
				</select>
				<button type="submit">Update</button>
			</form>

			<h2>Upload a new version</h2>
			<p class="muted">
				Save your project as an .sb3 from the editor (Ctrl+S or File, Save to your computer) and
				upload it here. Every upload becomes a version in the history.
			</p>
			<form method="post" action="?/upload" enctype="multipart/form-data" class="row">
				<input
					type="file"
					name="file"
					accept=".sb3,application/x.scratch.sb3,application/zip"
					required
				/>
				<button type="submit">Upload</button>
			</form>

			<h2>Delete</h2>
			{#if confirmDelete}
				<form method="post" action="?/delete" class="row">
					<span>This removes the project and its history for good.</span>
					<button type="submit" class="danger">Yes, delete it</button>
					<button type="button" class="secondary" onclick={() => (confirmDelete = false)}
						>Keep it</button
					>
				</form>
			{:else}
				<div>
					<button type="button" class="danger" onclick={() => (confirmDelete = true)}
						>Delete project</button
					>
				</div>
			{/if}
		</section>
	{/if}
</div>
