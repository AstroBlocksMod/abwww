/** A text field of a form, or `fallback` when it is missing or is a file instead of text. */
export function formText(form: FormData, name: string, fallback = ''): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : fallback;
}
