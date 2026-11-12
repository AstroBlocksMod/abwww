<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function when(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleString();
	}
</script>

<svelte:head>
	<title>History of {data.project.title}</title>
</svelte:head>

<div class="stack">
	<h1 style="margin: 0">
		History of <a href="/projects/{data.project.id}">{data.project.title}</a>
	</h1>
	<p class="muted">
		Every save is a version. Open one to play it, or restore it to make it the current version
		again. Restoring adds a version; nothing is thrown away.
	</p>
	{#if form?.error}
		<p class="notice error">{form.error}</p>
	{/if}
	{#if form?.restored}
		<p class="notice success">Restored version {form.restored.slice(0, 7)}.</p>
	{/if}

	{#if data.history.length === 0}
		<p class="muted">No versions yet.</p>
	{:else}
		<table class="card">
			<thead>
				<tr>
					<th>Version</th>
					<th>What</th>
					<th>Who</th>
					<th>When</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.history as entry (entry.oid)}
					<tr>
						<td>
							<a href="/projects/{data.project.id}?v={entry.oid}"
								><span class="code">{entry.oid.slice(0, 7)}</span></a
							>
							{#if entry.oid === data.project.headCommit}
								<span class="muted">(current)</span>
							{/if}
						</td>
						<td>{entry.message}</td>
						<td>{entry.author}</td>
						<td>{when(entry.timestamp)}</td>
						<td>
							{#if data.isOwner && entry.oid !== data.project.headCommit}
								<form method="post" action="?/restore" use:enhance>
									<input type="hidden" name="oid" value={entry.oid} />
									<button type="submit" class="secondary">Restore</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
