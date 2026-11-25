import { readFileSync } from 'fs';
import { resolveStdlibInclude } from './stdlibResolver';

export function resolveTestInclude(includeId: string): string | undefined {
	if (!includeId.startsWith('test/')) {
		return resolveStdlibInclude(includeId);
	}

	try {
		return readFileSync(new URL(`./include-sources/${includeId.slice(5)}.8f4e`, import.meta.url), 'utf8');
	} catch {
		return undefined;
	}
}
