import type { AssertionSite, CompileResult, ProjectObjectModel } from '@8f4e/language-spec';
import { ASSERTION_IMPORT_NAMES, WASM_MEMORY_PAGE_SIZE } from '@8f4e/language-spec';

/** One invocation; loops can execute the same static site several times. */
export type TestAssertionResult = {
	assertIndex: number;
	site: AssertionSite;
	passed: boolean;
} & ({ condition: number } | { received: number; expected: number });

/** Executable artifacts shared by fresh-memory and supplied-memory runs. */
export type TestProgram = Pick<CompileResult, 'codeBuffer' | 'assertionSites'>;

export type TestRunInput = TestProgram &
	({ memory: WebAssembly.Memory } | ({ memory?: undefined } & Pick<CompileResult, 'requiredMemoryBytes'>));

/** Detects an enabled test entry or a root function exported as `test`. */
export function hasTestEntry(project: ProjectObjectModel): boolean {
	function hasTestModules(project: ProjectObjectModel): boolean {
		return (
			project.modules.some(block => !block.disabled && block.entry === 'test') || project.groups.some(hasTestModules)
		);
	}
	return (
		hasTestModules(project) ||
		project.functions.some(block => {
			if (block.disabled) return false;
			const [openingLine, ...body] = block.code.map(line => line.split(';')[0].trim());
			return body.some(line => line === '#export test' || (openingLine === 'function test' && line === '#export'));
		})
	);
}

function createMemory(requiredMemoryBytes: number): WebAssembly.Memory {
	const pages = Math.max(1, Math.ceil(requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE));
	return new WebAssembly.Memory({ initial: pages, maximum: pages });
}

function getExportedFunction(instance: WebAssembly.Instance, name: string): CallableFunction {
	const exported = instance.exports[name];
	if (typeof exported !== 'function')
		throw new Error(`Expected compiled test WebAssembly to export function "${name}"`);
	return exported;
}

/** Execute once, initializing fresh memory only when the caller has not supplied its own memory. */
export async function runTests(compiled: TestRunInput) {
	const sites = compiled.assertionSites;
	if (!sites) throw new Error('Test compilation requires enableAssertions: true');
	const assertions: TestAssertionResult[] = [];
	const equal = (received: number, expected: number, siteId: number) => {
		assertions.push({
			assertIndex: assertions.length,
			site: sites[siteId]!,
			received,
			expected,
			passed: received === expected,
		});
	};
	const memory = compiled.memory ?? createMemory(compiled.requiredMemoryBytes);
	const host = {
		memory,
		[ASSERTION_IMPORT_NAMES.assert]: (condition: number, siteId: number) => {
			assertions.push({ assertIndex: assertions.length, site: sites[siteId]!, condition, passed: condition !== 0 });
		},
		[ASSERTION_IMPORT_NAMES.assertEqual.int]: equal,
		[ASSERTION_IMPORT_NAMES.assertEqual.float]: equal,
		[ASSERTION_IMPORT_NAMES.assertEqual.float64]: equal,
	};
	const { instance } = await WebAssembly.instantiate(new Uint8Array(compiled.codeBuffer), { host });
	if (!compiled.memory) getExportedFunction(instance, 'initDefaults')();
	getExportedFunction(instance, 'test')();
	return { instance, memory, assertions, failures: assertions.filter(assertion => !assertion.passed) };
}

/** Formats the expected and received values for console and inline failure reporting. */
export function formatAssertionExpectation(assertion: TestAssertionResult): string {
	return 'condition' in assertion
		? `expected nonzero, received ${assertion.condition}`
		: `expected ${assertion.expected}, received ${assertion.received}`;
}

/** Formats a failure with a one-based physical line within the original block. */
function formatAssertionFailure(failure: TestAssertionResult): string {
	const { site } = failure;
	const name = site.projectGroupPath ? `${site.projectGroupPath}/${site.codeBlockId}` : site.codeBlockId;
	const expectation = formatAssertionExpectation(failure);
	const source = site.source ? `, include ${site.source.includeId} (${site.source.symbolName})` : '';
	return `${site.instruction} #${failure.assertIndex} ${expectation} at ${site.codeBlockType} ${name}, block line ${site.lineNumber + 1}${source} (site ${site.siteId})`;
}

export function formatTestFailures(failures: TestAssertionResult[]): string {
	return [
		`${failures.length} assertion${failures.length === 1 ? '' : 's'} failed:`,
		...failures.map(failure => `  ${formatAssertionFailure(failure)}`),
	].join('\n');
}
