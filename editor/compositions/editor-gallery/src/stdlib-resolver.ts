import sources from 'virtual:8f4e-sources/stdlib';

export async function resolveStdlibInclude(includeId: string): Promise<string | undefined> {
	return sources.get(includeId)?.();
}
