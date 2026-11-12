<script lang="ts">
	import ProjectCard from '#lib/components/ProjectCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<section>
	<div class="section-title">
		<h2>Recently shared</h2>
		<a href="/projects/upload">Share your own</a>
	</div>
	{#if data.projects.length === 0}
		<p class="muted">Nothing has been shared yet. Upload a project and share it to be the first.</p>
	{:else}
		<div class="grid">
			{#each data.projects as project (project.id)}
				<ProjectCard
					id={project.id}
					title={project.title}
					ownerUsername={project.ownerUsername}
					updatedAt={project.sharedAt ?? project.updatedAt}
				/>
			{/each}
		</div>
	{/if}
</section>
