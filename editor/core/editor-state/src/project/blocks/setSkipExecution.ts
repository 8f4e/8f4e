import { instructionParser, isSkipExecutionDirective } from '@8f4e/tokenizer';

/** Sets the execution directive and reports whether the source changed. */
export default function setSkipExecution(code: string[], skipExecution: boolean): { code: string[]; changed: boolean } {
	const hasDirective = code.some(line => isSkipExecutionDirective(line));
	if (hasDirective === skipExecution) {
		return { code, changed: false };
	}

	if (!skipExecution) {
		return { code: code.filter(line => !isSkipExecutionDirective(line)), changed: true };
	}

	const moduleHeaderIndex = code.findIndex(line => {
		const match = line.match(instructionParser);
		return match && match[1] === 'module';
	});
	if (moduleHeaderIndex === -1) {
		return { code, changed: false };
	}

	return {
		code: [...code.slice(0, moduleHeaderIndex + 1), '#skipExecution', ...code.slice(moduleHeaderIndex + 1)],
		changed: true,
	};
}
