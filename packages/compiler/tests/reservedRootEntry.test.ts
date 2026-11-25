import {
	createProjectObjectModel,
	ErrorCode,
	type ProjectObjectModel,
	WASM_MEMORY_PAGE_SIZE,
} from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';

const source = `8f4e/v1
entry initDefaults
module voice
int value 7
moduleEnd
entryEnd`;

const directProject: ProjectObjectModel = {
	...createProjectObjectModel(),
	entries: ['initDefaults'],
	execution: [
		{
			type: 'module',
			id: 1,
			entry: 'initDefaults',
			code: ['module voice', 'int value 7', 'moduleEnd'],
		},
	],
};

describe('reserved root entry exports', () => {
	it.each([
		['parsed source', () => parseProjectSource(source)],
		['direct project model', () => directProject],
		['empty root entry', () => ({ ...createProjectObjectModel(), entries: ['initDefaults'] })],
	] as const)('rejects initDefaults in %s', async (_name, getProject) => {
		const project = getProject();
		await expect(compileProject(project)).rejects.toMatchObject({
			message: expect.stringContaining('reserved'),
			diagnostic: {
				kind: 'source',
				domain: 'semantic',
				code: ErrorCode.RESERVED_ROOT_ENTRY_NAME,
				instruction: 'entry',
				symbol: 'initDefaults',
				location: { kind: 'project-entry', projectGroupPath: '', entryName: 'initDefaults' },
			},
		});
	});

	it('allows a group-local initDefaults entry without shadowing the generated initializer', async () => {
		const project = parseProjectSource(`8f4e/v1
entry main
group voice
entry main
module driver
call initDefaults
moduleEnd
entryEnd
entry initDefaults
module state
int value 7
push &value
push 9
store
moduleEnd
entryEnd
groupEnd
entryEnd`);
		const result = await compileProject(project);
		const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / WASM_MEMORY_PAGE_SIZE));
		const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
		const { instance } = await WebAssembly.instantiate(result.codeBuffer, { host: { memory } });

		expect(Object.keys(instance.exports).sort()).toEqual(['initDefaults', 'main']);
		(instance.exports.initDefaults as CallableFunction)();
		const address = result.memoryPlan.modules['voice/state'].memory.value.byteAddress;
		const data = new DataView(memory.buffer);
		expect(data.getInt32(address, true)).toBe(7);
		(instance.exports.main as CallableFunction)();
		expect(data.getInt32(address, true)).toBe(9);
	});
});
