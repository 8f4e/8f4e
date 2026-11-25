import { EventEmitter } from 'node:events';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { ErrorCode, getProjectGroups } from '@8f4e/language-spec';
import { expect, it } from 'vitest';
import initState, {
	applyCodeBlockSourceEdits,
	createEditorCommandApi,
	getEditorBlockId,
	insertCodeBlocks,
	serializeCodeBlocks,
	serializeToProject,
	setGridSize,
} from '~/index';
import { getProjectGroupMemoryExposures } from './projectGroupMemoryExposures';

const source = `8f4e/v1
entry main
group patch
expose output &source:first
entry main
module source
float first 1
float second 2
moduleEnd
entryEnd
groupEnd
group sibling
expose output &source:value
entry main
module source
float value 4
moduleEnd
entryEnd
groupEnd
module consumer
float& input &patch:output
float& otherInput &sibling:output
moduleEnd
entryEnd
note description
Original
noteEnd`;

function setup() {
	const emitter = new EventEmitter();
	const events = { on: emitter.on.bind(emitter), off: emitter.off.bind(emitter), dispatch: emitter.emit.bind(emitter) };
	const store = initState(events, { callbacks: {} });
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	const state = store.getState();
	const group = () => state.project.rootLevel.blocks.find(block => block.name === 'patch')!;
	const serialize = () => serializeToProject(state);
	return { store, state, events, group, serialize };
}

it('shares current source exposure metadata while leaving accepted targets in place until recompilation', async () => {
	const test = setup();
	try {
		const compiled = await compileProject(test.serialize());
		test.state.compiler.result = { ...test.state.compiler.result, ...compiled };
		const accepted = compiled.projectMemoryExposuresByGroupPath.patch[0];
		expect(getProjectGroupMemoryExposures(test.group(), test.state)[0]).toBe(accepted);

		const code = ['group patch', '; changed position and target', 'expose output &source:second', 'groupEnd'];
		applyCodeBlockSourceEdits(test.store, [{ codeBlock: test.group(), code }]);
		expect(getProjectGroupMemoryExposures(test.group(), test.state)[0]).toMatchObject({
			lineNumber: 2,
			targetMemory: accepted.targetMemory,
		});
		const serialized = test.serialize();
		const exposures = getProjectGroups(serialized)[0].exposures;
		expect(exposures).toEqual([
			{ name: 'output', targetModuleName: 'source', targetMemoryName: 'second', lineNumber: 2 },
		]);
		expect((await compileProject(serialized)).projectMemoryExposuresByGroupPath.patch[0].targetMemory.name).toBe(
			'second'
		);
		exposures[0].targetMemoryName = 'detached';
		expect(getProjectGroups(test.serialize())[0].exposures[0].targetMemoryName).toBe('second');

		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock: test.group(), code: ['group patch', 'expose output', 'groupEnd'] },
		]);
		expect(getProjectGroups(test.serialize())[0]).toMatchObject({
			code: ['group patch', 'expose output', 'groupEnd'],
			exposures: [],
		});
		expect(getProjectGroupMemoryExposures(test.group(), test.state)).toEqual([]);
	} finally {
		test.store.dispose();
	}
});

it('keeps settled exposure records current and preserves compiler diagnostics for unresolved targets', async () => {
	const test = setup();
	test.events.dispatch('enterEditMode');
	const { handle, dispose } = createEditorCommandApi(test.store, test.events);
	try {
		const note = test.state.project.rootLevel.blocks.find(block => block.name === 'description')!;
		handle.applyEdits({
			expectedRevision: handle.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(note), code: ['note description', 'Edited', 'noteEnd'] }],
		});
		expect(getProjectGroups(test.serialize())[0].exposures[0].targetMemoryName).toBe('first');

		const code = ['group patch', '', 'expose output &source:missing', 'groupEnd'];
		handle.applyEdits({
			expectedRevision: handle.getRevision(),
			edits: [{ type: 'update', blockId: getEditorBlockId(test.group()), code }],
		});
		const project = test.serialize();
		expect(getProjectGroups(project)[0].exposures).toEqual([
			{ name: 'output', targetModuleName: 'source', targetMemoryName: 'missing', lineNumber: 2 },
		]);
		await expect(compileProject(project)).rejects.toMatchObject({
			diagnostic: {
				code: ErrorCode.INVALID_PROJECT_MEMORY_EXPOSURE_TARGET,
				location: { kind: 'block', projectBlockId: test.group().creationIndex, projectGroupPath: '', lineNumber: 2 },
			},
		});
	} finally {
		dispose();
		test.store.dispose();
	}
});

it('locates an invalid copied group wrapper by its own block ID', async () => {
	const test = setup();
	try {
		setGridSize(test.state, test.events, { vGrid: 8, hGrid: 16 });
		test.events.dispatch('enterEditMode');
		const original = test.group();
		const [copy] = insertCodeBlocks(test.store, { x: 240, y: 128, blocks: serializeCodeBlocks([original], original) });
		expect(copy.childLevel!.path).toBe(original.childLevel!.path);
		applyCodeBlockSourceEdits(test.store, [{ codeBlock: copy, code: ['group patch', 'pass', 'groupEnd'] }]);
		await expect(compileProject(test.serialize())).rejects.toMatchObject({
			diagnostic: {
				instruction: 'pass',
				location: { kind: 'block', projectBlockId: copy.creationIndex, projectGroupPath: '', lineNumber: 1 },
			},
		});
	} finally {
		test.store.dispose();
	}
});

it('preserves root references to a group through API edits and snapshot restoration while it is open', async () => {
	const test = setup();
	test.events.dispatch('enterEditMode');
	const { handle, navigation, dispose } = createEditorCommandApi(test.store, test.events);
	try {
		const readExposures = (project: ReturnType<typeof test.serialize>) =>
			getProjectGroups(project).map(({ name, exposures }) => ({ name, exposures }));
		const expectedExposures = readExposures(test.serialize());
		expect(expectedExposures.map(({ name, exposures }) => [name, exposures.length])).toEqual([
			['patch', 1],
			['sibling', 1],
		]);
		navigation.openGroup(getEditorBlockId(test.group()));
		const activeLevel = () => test.state.project.activeLevel;
		const expectRestoredGroup = async (defaultValue: number) => {
			expect(activeLevel().path).toBe('patch');
			const project = test.serialize();
			expect(readExposures(project)).toEqual(expectedExposures);
			const compiled = await compileProject(project);
			const { targetMemory } = compiled.compiledModules.consumer.referenceSlots.input;
			expect(compiled.memoryDefaultsByModuleId['patch/source'][targetMemory.id].value).toBe(defaultValue);
		};

		const original = test.store.projectTransactions.capture();
		const block = activeLevel().blocks.find(block => block.name === 'source')!;
		handle.applyEdits({
			expectedRevision: handle.getRevision(),
			edits: [
				{ type: 'update', blockId: getEditorBlockId(block), code: ['module source', 'float first 3', 'moduleEnd'] },
			],
		});
		await expectRestoredGroup(3);

		const edited = test.store.projectTransactions.capture();
		test.store.projectTransactions.restore(original);
		await expectRestoredGroup(1);

		test.store.projectTransactions.restore(edited);
		await expectRestoredGroup(3);
	} finally {
		dispose();
		test.store.dispose();
	}
});
