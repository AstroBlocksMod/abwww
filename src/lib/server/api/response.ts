/**
 * TypeScript's `BodyInit` wants a `Uint8Array<ArrayBuffer>`, while Bun's APIs hand out views
 * typed over `ArrayBufferLike`. The bytes are fine for `Response`; only the type needs convincing.
 */
export function bytesResponse(bytes: Uint8Array, init?: ResponseInit): Response {
	return new Response(bytes as unknown as BodyInit, init);
}
