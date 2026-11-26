import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export function resolveStdlibInclude(includeId: string): string | undefined {
	try {
		const url = import.meta.resolve(`@8f4e/stdlib/${includeId}.8f4e`);
		return readFileSync(fileURLToPath(url), 'utf8');
	} catch {
		return undefined;
	}
}
