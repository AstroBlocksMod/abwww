<script lang="ts">
	interface Props {
		id: number;
		title: string;
		ownerUsername: string;
		visibility?: 'private' | 'unlisted' | 'public';
		updatedAt?: Date | string;
	}

	let { id, title, ownerUsername, visibility = 'public', updatedAt }: Props = $props();

	const when = $derived(updatedAt ? new Date(updatedAt).toLocaleDateString() : null);
</script>

<a class="project-card" href="/projects/{id}">
	<div class="thumb">
		<img src="/rubble.png" alt="" />
	</div>
	<div class="body">
		<div class="title">{title}</div>
		<div class="meta">
			by {ownerUsername}{#if when},&nbsp;{when}{/if}
			{#if visibility !== 'public'}
				<span class="pill">{visibility}</span>
			{/if}
		</div>
	</div>
</a>
