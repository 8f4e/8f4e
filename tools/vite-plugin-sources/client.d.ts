declare module 'virtual:8f4e-sources/*' {
	const sources: ReadonlyMap<string, () => Promise<string>>;
	export default sources;
}

declare module 'virtual:8f4e-source-urls/*' {
	const urls: ReadonlyMap<string, string>;
	export default urls;
}
