<script lang="ts">
	import ProjectCard from '#lib/components/ProjectCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const joined = $derived(new Date(data.profile.createdAt).toLocaleDateString());
</script>

<svelte:head>
	<title>{data.profile.displayName ?? data.profile.username}</title>
</svelte:head>

<div class="stack">
	<section class="card">
		<div class="row" style="align-items: center; gap: 1rem">
			<img src="/rubble.png" alt="" width="64" height="64" style="image-rendering: pixelated" />
			<div>
				<h1 style="margin: 0">{data.profile.displayName ?? data.profile.username}</h1>
				<p class="muted" style="margin: 0.25rem 0 0">
					@{data.profile.username}, joined {joined}
					{#if data.profile.scratchUsername}
						, on Scratch as
						<a href="https://scratch.mit.edu/users/{data.profile.scratchUsername}/" rel="noopener">
							{data.profile.scratchUsername}
						</a>
					{/if}
				</p>
			</div>
		</div>
		{#if data.profile.bio}
			<pre class="notes" style="margin-top: 1rem">{data.profile.bio}</pre>
		{/if}
		{#if data.isOwner}
			<p style="margin-bottom: 0"><a href="/settings">Edit profile</a></p>
		{/if}
	</section>

	<section>
		<div class="section-title">
			<h2>Projects</h2>
		</div>
		{#if data.projects.length === 0}
			<p class="muted">No projects yet.</p>
		{:else}
			<div class="grid">
				{#each data.projects as project (project.id)}
					<ProjectCard
						id={project.id}
						title={project.title}
						ownerUsername={project.ownerUsername}
						visibility={project.visibility}
						updatedAt={project.updatedAt}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>
