import type { CompilerDiagnostic } from '@8f4e/language-spec';

export interface ResolveIncludeRequestMessage {
	type: 'resolveInclude';
	payload: {
		requestId: number;
		includeId: string;
	};
}

export interface ResolveIncludeSuccessMessage {
	type: 'resolveIncludeResult';
	payload: {
		requestId: number;
		source: string | undefined;
	};
}

export interface ResolveIncludeErrorMessage {
	type: 'resolveIncludeResult';
	payload: {
		requestId: number;
		error: CompilerDiagnostic;
	};
}

export type ResolveIncludeResultMessage = ResolveIncludeSuccessMessage | ResolveIncludeErrorMessage;
