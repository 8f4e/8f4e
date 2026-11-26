import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const collectionSpecifiers = {
	projects: '@8f4e/examples/projects',
	modules: '@8f4e/examples/modules',
	benchmarks: '@8f4e/compiler-benchmarks/cases',
} as const;

export type ProgramCollection = keyof typeof collectionSpecifiers;
export type ProgramSourceId = `${ProgramCollection}/${string}`;

/** Resolve an exported collection directory for test discovery. */
export function collectionRoot(collection: ProgramCollection): string {
	return fileURLToPath(import.meta.resolve(collectionSpecifiers[collection]));
}

/** Read a program by its collection-relative ID rather than its workspace path. */
export function readProgramSource(id: ProgramSourceId): Promise<string> {
	const separator = id.indexOf('/');
	const collection = id.slice(0, separator) as ProgramCollection;
	const path = id.slice(separator + 1);
	return readFile(new URL(import.meta.resolve(`${collectionSpecifiers[collection]}/${path}`)), 'utf8');
}

/** Read a complete example project using its exported source path. */
export function readExampleProject(path: string): Promise<string> {
	return readProgramSource(`projects/${path}`);
}

/** Resolve standard-library includes through the same public source exports used by the hosts. */
export async function resolveStdlibInclude(includeId: string): Promise<string | undefined> {
	try {
		return await readFile(new URL(import.meta.resolve(`@8f4e/stdlib/${includeId}.8f4e`)), 'utf8');
	} catch {
		return undefined;
	}
}
