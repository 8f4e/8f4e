import { extractUseDependencies } from '@8f4e/tokenizer';

const upperCaseWords = new Set(['lsb', 'msb', 'midi', 'pcm', 'cga', 'crt', 'xor']);
const preserveCaseWords = new Set(['8bit', '16bit', '32bit']);

function humanizeSlug(slug: string): string {
	return slug
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/[-_]/g, ' ')
		.trim()
		.split(/\s+/)
		.map(word => {
			const lower = word.toLowerCase();
			if (upperCaseWords.has(lower)) {
				return lower.toUpperCase();
			}
			if (preserveCaseWords.has(lower)) {
				return lower;
			}
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');
}

export function createModuleCatalog(sources: ReadonlyMap<string, () => Promise<string>>) {
	const loaders = new Map<string, () => Promise<string>>();
	const modules: Array<{ slug: string; title: string; category: string }> = [];
	const loadedSources = new Map<string, string>();
	for (const [id, load] of sources) {
		const segments = id.split('/');
		const slug = segments.pop()!;
		if (loaders.has(slug)) throw new Error(`Duplicate example module slug: ${slug}`);
		loaders.set(slug, load);
		modules.push({
			slug,
			title: humanizeSlug(slug),
			category: segments
				.map(segment =>
					segment
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ')
				)
				.join('/'),
		});
	}
	modules.sort((left, right) => left.slug.localeCompare(right.slug));
	async function getModule(slug: string): Promise<string> {
		const cached = loadedSources.get(slug);
		if (cached !== undefined) return cached;
		const source = await loaders.get(slug)!();
		loadedSources.set(slug, source);
		return source;
	}
	async function getModuleDependencies(slug: string): Promise<string[]> {
		return extractUseDependencies(await getModule(slug)).filter(
			dependency => dependency !== slug && loaders.has(dependency)
		);
	}
	return { modules, getModule, getModuleDependencies };
}
