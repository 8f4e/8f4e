import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';

export async function resolveStdlibInclude(includeId: string): Promise<string | undefined> {
	try {
		const url = import.meta.resolve(`@8f4e/stdlib/${includeId}.8f4e`);
		return await readFile(fileURLToPath(url), 'utf8');
	} catch {
		return undefined;
	}
}
