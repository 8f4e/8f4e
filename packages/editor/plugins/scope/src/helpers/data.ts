import { isPointerSource, matchEditorDirectives, parseFiniteNumber } from '@8f4e/editor-state';
import type { ParsedDirectiveRecord } from '@8f4e/editor-state-types';

/** Faster interval requests did not increase sustained browser sampling throughput. */
export const MAX_SCOPE_SAMPLE_RATE_HZ = 250;

export interface ScopeDirectiveData {
	memoryId: string;
	lineNumber: number;
	sampleRate: number;
	minValueOverride?: number;
	maxValueOverride?: number;
}

interface ScopeDirectiveDiagnostic {
	lineNumber: number;
	message: string;
}

type ScopeDirectiveResult =
	| { kind: 'scope'; data: ScopeDirectiveData }
	| { kind: 'error'; diagnostic: ScopeDirectiveDiagnostic };

interface ScopeDirectives {
	scopes: readonly ScopeDirectiveData[];
	diagnostics: readonly ScopeDirectiveDiagnostic[];
}

export type ScopeDirectiveReader = (directives: readonly ParsedDirectiveRecord[]) => ScopeDirectives;

/** Rates are in Hz. Keep intervals within the representable range of browser timers. */
export function interpretScopeDirective(args: readonly string[], lineNumber: number): ScopeDirectiveResult | undefined {
	const sampleRate = parseFiniteNumber(args[1]);
	if (sampleRate !== undefined && sampleRate > MAX_SCOPE_SAMPLE_RATE_HZ) {
		return {
			kind: 'error',
			diagnostic: {
				lineNumber,
				message: `@scope: sample rate must not exceed ${MAX_SCOPE_SAMPLE_RATE_HZ} Hz.`,
			},
		};
	}
	if (
		(args.length !== 2 && args.length !== 4) ||
		!isPointerSource(args[0]) ||
		sampleRate === undefined ||
		sampleRate <= 0 ||
		1000 / sampleRate > 2_147_483_647
	)
		return;

	const minValueOverride = parseFiniteNumber(args[2]);
	const maxValueOverride = parseFiniteNumber(args[3]);
	if (
		args.length === 4 &&
		(minValueOverride === undefined ||
			maxValueOverride === undefined ||
			minValueOverride >= maxValueOverride ||
			!Number.isFinite(maxValueOverride - minValueOverride))
	)
		return;

	return {
		kind: 'scope',
		data: {
			memoryId: args[0],
			lineNumber,
			sampleRate,
			minValueOverride,
			maxValueOverride,
		},
	};
}

/** Core replaces its cached directive records when source changes; geometry refreshes retain their identity. */
export function createScopeDirectiveReader(): ScopeDirectiveReader {
	const cache = new WeakMap<readonly ParsedDirectiveRecord[], ScopeDirectives>();
	return directives => {
		const previous = cache.get(directives);
		if (previous) return previous;
		const scopes: ScopeDirectiveData[] = [];
		const diagnostics: ScopeDirectiveDiagnostic[] = [];
		for (const directive of matchEditorDirectives(directives, [{ name: 'scope' }])) {
			const result = interpretScopeDirective(directive.args, directive.sourceLineIndex);
			if (result?.kind === 'scope') scopes.push(result.data);
			else if (result?.kind === 'error') diagnostics.push(result.diagnostic);
		}
		const result = { scopes, diagnostics };
		cache.set(directives, result);
		return result;
	};
}
