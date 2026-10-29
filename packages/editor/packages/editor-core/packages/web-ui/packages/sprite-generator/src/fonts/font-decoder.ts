/** Decodes packed glyph rows without copying them into ordinary number arrays. */
export default function decodeFontBase64(base64: string, bytesPerValue: 1 | 2): Uint8Array | Uint16Array {
	const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
	return bytesPerValue === 1 ? bytes : new Uint16Array(bytes.buffer);
}
