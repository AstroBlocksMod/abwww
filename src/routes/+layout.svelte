<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const isActive = (path: string) => page.url.pathname === path;
</script>

<svelte:head>
	<title>{data.siteName}</title>
	<link rel="icon" href="/rubble.png" type="image/png" />
	<link rel="apple-touch-icon" href="/rubble-512.png" />
	<meta name="theme-color" content="#4c97ff" />
</svelte:head>

<header class="site-header">
	<div class="inner">
		<a class="brand" href="/">
			<img src="/rubble.png" alt="" width="32" height="32" />
			{data.siteName}
		</a>
		<nav>
			<a href="/" class:active={isActive('/')}>Explore</a>
			{#if data.editorInstalled}
				<a href={data.newProjectUrl} target="_blank" rel="noopener">Create</a>
			{/if}
			<a href="/projects/upload" class:active={isActive('/projects/upload')}>Upload</a>
			<span class="spacer"></span>
			{#if data.user}
				<a href="/users/{data.user.username}">{data.user.username}</a>
				<a href="/settings" class:active={isActive('/settings')}>Settings</a>
				<form method="post" action="/logout" style="display: contents">
					<button type="submit">Sign out</button>
				</form>
			{:else}
				<a href="/login" class:active={isActive('/login')}>Sign in</a>
				{#if data.registrationOpen}
					<a class="join" href="/register">Join</a>
				{/if}
			{/if}
		</nav>
	</div>
</header>

<main>
	{@render children()}
</main>

<footer class="site-footer">
	<div class="inner">
		{data.siteName} runs on <a href="https://github.com/AstroBlocksMod">abwww</a>, free software
		under the AGPL-3.0. Projects play in the AstroBlocks editor.
	</div>
</footer>
