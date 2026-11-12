<script lang="ts">
	interface Props {
		src: string;
		title: string;
	}

	let { src, title }: Props = $props();
</script>

<!--
	The player runs untrusted project code (custom extensions included). The editor's SVG renderer
	needs `allow-same-origin` to work, so what keeps a project away from the site's session is the
	editor living on its own origin (EDITOR_URL), not the sandbox. The sandbox still keeps it from
	navigating this page or opening things without a user gesture.
-->
<div class="player">
	<iframe
		class="player-frame"
		{src}
		{title}
		sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-downloads"
		allow="autoplay; fullscreen; gamepad"
	></iframe>
</div>
