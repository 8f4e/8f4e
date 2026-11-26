declare module 'virtual:8f4e-sources/*' {
	const sources: ReadonlyMap<string, () => Promise<string>>;
	export default sources;
}
