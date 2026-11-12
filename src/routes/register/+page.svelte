<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1>Join</h1>

{#if data.closed}
	<p class="notice">This instance is not taking new accounts right now.</p>
{:else}
	<form method="post" class="stack card" style="max-width: 24rem">
		{#if form?.error}
			<p class="notice error">{form.error}</p>
		{/if}
		<label>
			Username
			<input
				type="text"
				name="username"
				required
				minlength="3"
				maxlength="20"
				value={form?.username ?? ''}
			/>
		</label>
		<label>
			Password
			<input type="password" name="password" required minlength="8" autocomplete="new-password" />
		</label>
		<button type="submit">Create account</button>
		<p class="muted">Already have one? <a href="/login">Sign in</a>.</p>
	</form>
{/if}
