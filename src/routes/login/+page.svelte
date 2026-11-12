<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<h1>Sign in</h1>

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
			autocomplete="username"
			value={form?.username ?? ''}
		/>
	</label>
	<label>
		Password
		<input type="password" name="password" required autocomplete="current-password" />
	</label>
	<button type="submit">Sign in</button>
	<p class="muted">New here? <a href="/register">Create an account</a>.</p>
</form>
