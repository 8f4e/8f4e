/** Remove presentation markup while preserving 8f4e sigils and identifier spelling. */
export function plainMarkdown(text: string): string {
	return (
		text
			// Consume code spans before emphasis so code such as __init__ remains literal.
			.replace(
				/(`+)([\s\S]*?)\1|(?<![\w*])(\*\*|__)(\S(?:.*?\S)?)\3(?![\w*])/g,
				(_match, codeMarker, code, _emphasis, prose) => (codeMarker ? code : plainMarkdown(prose))
			)
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/** Use the same token spelling in the build-time index and runtime queries. */
export function normalizeSearch(text: string): string {
	return text
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.replace(/[^\w#@*&[\]]+/g, ' ')
		.trim();
}
