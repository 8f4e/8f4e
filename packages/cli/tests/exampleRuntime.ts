import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import {
	createProjectObjectModel,
	getProjectGroups,
	type ProjectBlock,
	type ProjectObjectModel,
} from '@8f4e/language-spec';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

export async function loadExample(
	relativePath: string,
	transform: (source: string) => string = source => source,
	offset = 0,
	scopeFunction?: string
) {
	const original = await readFile(new URL('../../examples/src/projects/' + relativePath, import.meta.url), 'utf8');
	let project = parseProjectSource(transform(original));
	if (scopeFunction) {
		const find = (unit: ProjectObjectModel, inherited: ProjectBlock[]): ProjectObjectModel | undefined => {
			const constants = [...inherited, ...unit.constants];
			if (unit.functions.some(fn => fn.code[0] === 'function ' + scopeFunction)) {
				const byName = new Map(constants.map(block => [block.code[0], block]));
				return {
					...createProjectObjectModel(),
					functions: unit.functions,
					includes: unit.includes,
					prototypes: unit.prototypes,
					constants: [...byName.values()],
				};
			}
			for (const child of getProjectGroups(unit)) {
				const selected = find(child, constants);
				if (selected) return selected;
			}
			return undefined;
		};
		project =
			find(project, []) ??
			(() => {
				throw new Error('Missing scope: ' + scopeFunction);
			})();
	}
	const result = await compileProject(project, {
		resolveInclude: resolveStdlibInclude,
		startingMemoryAllocationUnitAddress: offset,
	});
	const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
	const bytes = new Uint8Array(memory.buffer);
	bytes.fill(0xa5);
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as () => void)();
	const modules = result.memoryPlan.modules;
	const view = new DataView(memory.buffer);
	return {
		result,
		bytes,
		instance,
		modules,
		view,
		step: instance.exports.main as () => void,
		call: (name: string, ...args: number[]) => (instance.exports[name] as (...args: number[]) => number)(...args),
	};
}

/** Export a wrapper in the same source scope as the project's real function. */
export function withProbe(source: string, name: string, params: string[], result: string, impure = false): string {
	const marker = 'function ' + name + '\n';
	const exported = 'probe' + name[0].toUpperCase() + name.slice(1);
	const wrapper = [
		'function ' + exported,
		'#export ' + exported,
		...(impure ? ['#impure'] : []),
		...params.map(param => 'param ' + param),
		'call ' + name + ' ' + params.map(param => param.split(' ').at(-1)).join(' '),
		'functionEnd ' + result,
		'',
	].join('\n');
	return source.includes(marker) ? source.replace(marker, wrapper + marker) : source + '\n' + wrapper;
}

export function nextFloat32(value: number, direction: -1 | 1): number {
	const storage = new ArrayBuffer(4);
	const float = new Float32Array(storage);
	const bits = new Uint32Array(storage);
	float[0] = value;
	if (value === 0) return direction * 2 ** -149;
	bits[0] += (value > 0 ? 1 : -1) * direction;
	return float[0];
}
