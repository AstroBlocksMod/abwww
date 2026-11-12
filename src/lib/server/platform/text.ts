/** Escapes `& < > " '` so user text can go into HTML we generate (federated notes, for one). */
export function escapeHtml(text: string): string {
	return Bun.escapeHTML(text);
}
