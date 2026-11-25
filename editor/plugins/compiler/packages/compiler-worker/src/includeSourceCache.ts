import type { ProjectIncludeResolver } from '@8f4e/language-spec';

export interface IncludeSourceCache {
	resolve: (includeId: string, load: () => ReturnType<ProjectIncludeResolver>) => Promise<string | undefined>;
}

/** Creates a worker-lifetime include cache that also shares in-flight source requests. */
export function createIncludeSourceCache(): IncludeSourceCache {
	const sourcePromises = new Map<string, Promise<string | undefined>>();

	return {
		resolve(includeId, load) {
			let sourcePromise = sourcePromises.get(includeId);
			if (!sourcePromise) {
				sourcePromise = Promise.resolve().then(load);
				sourcePromises.set(includeId, sourcePromise);
				sourcePromise.catch(() => {
					if (sourcePromises.get(includeId) === sourcePromise) {
						sourcePromises.delete(includeId);
					}
				});
			}
			return sourcePromise;
		},
	};
}
