/** Recognizes a leading &module: start-address reference. */
export default function isIntermodularModuleReference(value: string): boolean {
	return /^&[^\s&:.()]+:$/.test(value);
}
