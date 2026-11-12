<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Settings</title>
</svelte:head>

<h1>Settings</h1>

<div class="stack">
	{#if form?.error}
		<p class="notice error">{form.error}</p>
	{/if}

	<section class="card">
		<h2>Profile</h2>
		{#if form?.profileSaved}
			<p class="notice success">Profile saved.</p>
		{/if}
		<form method="post" action="?/profile" class="stack" use:enhance>
			<label>
				Display name
				<input
					type="text"
					name="displayName"
					maxlength="50"
					value={data.profile.displayName ?? ''}
				/>
			</label>
			<label>
				About me
				<textarea name="bio" maxlength="2000">{data.profile.bio}</textarea>
			</label>
			<div><button type="submit">Save</button></div>
		</form>
	</section>

	<section class="card">
		<h2>Scratch account</h2>
		{#if data.profile.scratchUsername}
			<p>
				Linked to
				<a href="https://scratch.mit.edu/users/{data.profile.scratchUsername}/" rel="noopener">
					{data.profile.scratchUsername}
				</a>
				on Scratch.
			</p>
			<form method="post" action="?/unlink" use:enhance>
				<button type="submit" class="danger">Unlink</button>
			</form>
		{:else if !data.target}
			<p class="muted">This instance has not set up Scratch account linking.</p>
		{:else if data.pending}
			<p>
				To prove that <strong>{data.pending.scratchUsername}</strong> is yours, post a comment
				containing this code on
				<a href={data.target.url} target="_blank" rel="noopener">the verification project</a>, then
				come back and check. The code works for 15 minutes.
			</p>
			<p><span class="code" style="font-size: 1.3rem">{data.pending.code}</span></p>
			<div class="row">
				<form method="post" action="?/checkVerification" use:enhance>
					<button type="submit">I posted it, check now</button>
				</form>
				<form method="post" action="?/cancelVerification" use:enhance>
					<button type="submit" class="secondary">Cancel</button>
				</form>
			</div>
		{:else}
			<p>
				Link your Scratch account to import your projects. You will post a code as a comment on a
				Scratch project; we never ask for your Scratch password.
			</p>
			<form method="post" action="?/startVerification" class="row" use:enhance>
				<input type="text" name="scratchUsername" placeholder="Scratch username" required />
				<button type="submit">Get a code</button>
			</form>
		{/if}
	</section>

	{#if data.profile.scratchUsername}
		<section class="card">
			<h2>Import from Scratch</h2>
			{#if data.scratchError}
				<p class="notice error">{data.scratchError}</p>
			{:else if data.scratchProjects.length === 0}
				<p class="muted">No shared projects found on your Scratch account.</p>
			{:else}
				<table>
					<thead>
						<tr><th>Project</th><th></th></tr>
					</thead>
					<tbody>
						{#each data.scratchProjects as project (project.id)}
							<tr>
								<td>
									<a href="https://scratch.mit.edu/projects/{project.id}/" rel="noopener"
										>{project.title}</a
									>
								</td>
								<td>
									<form method="post" action="?/import">
										<input type="hidden" name="scratchProjectId" value={project.id} />
										<button type="submit" class="secondary">Import</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}
</div>
