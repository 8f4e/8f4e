import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { expect, test } from 'vitest';
import { readExampleProject, resolveStdlibInclude } from './programSources';

test('FM envelope groups start independently with their own timing and feed the original operators', async () => {
	const source = await readExampleProject('audio/keyboardController6OperatorFMSynth.8f4e');
	const result = await compileProject(parseProjectSource(source), {
		resolveInclude: resolveStdlibInclude,
		startingMemoryAllocationUnitAddress: 0,
	});
	const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
	new Uint8Array(memory.buffer).fill(0xa5);
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as () => void)();
	const step = instance.exports.main as () => void;
	const view = new DataView(memory.buffer);
	const { modules } = result.memoryPlan;
	const keyboard = modules.keyboard.memory;
	const operators = [
		[480, 4800, 4800, 'carrier1', 'amplitudeMod'],
		[24, 24, 4800, 'modulator2', 'amplitude'],
		[480, 480, 48000, 'carrier3', 'amplitudeMod'],
		[4, 4, 48000, 'modulator4', 'amplitude'],
		[4, 4, 48000, 'carrier5', 'amplitude'],
		[4, 4, 24000, 'modulator6', 'amplitude'],
	] as const;
	const envelopes = operators.map(([attack, decay, release, operator, input], index) => {
		const group = `adsrEnv${index + 1}`;
		const memory = modules[`${group}/envelope`].memory;
		const read = (name: string) => view.getInt32(memory[name].byteAddress, true);
		const readTime = (name: string) => view.getInt32(read(name), true);

		expect([readTime('attackTime'), readTime('decayTime'), readTime('releaseTime')]).toEqual([attack, decay, release]);
		expect(read('trigger')).toBe(keyboard.keyPressed.byteAddress);
		expect(result.compiledModules[operator].referenceSlots[input].targetMemory.byteAddress).toBe(
			memory.out.byteAddress
		);
		return { attack, read, out: memory.out.byteAddress };
	});

	expect(new Set(envelopes.map(({ out }) => out)).size).toBe(operators.length);
	view.setInt32(keyboard.keyCode.byteAddress, 4, true);
	view.setInt32(keyboard.keyPressed.byteAddress, 1, true);
	step();
	for (const { attack, read } of envelopes) expect(read('_counter')).toBe(attack - 1);

	step();
	for (const { attack, out } of envelopes) expect(view.getFloat32(out, true)).toBeCloseTo(1 / attack, 6);
});
