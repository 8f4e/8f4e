/** Recognizes a leading &module:memory start-address reference. */
export default function isIntermodularReferencePattern(value: string): boolean {
	return /^&[^\s&:.()]+:[^\s&:.()]+$/.test(value);
}
