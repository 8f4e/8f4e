import { describe, expect, it, vi } from 'vitest';
import { createModuleCatalog } from './catalog';

describe('example module catalog', () => {
	it('derives metadata and nested categories without loading source', () => {
		const load = vi.fn();
		const catalog = createModuleCatalog(
			new Map([
				['oscillators/sawUnsigned8bitInt', load],
				['functions/midi-tools/midiCodes', load],
				['envelopes/adrEnvelope', load],
			])
		);
		expect(catalog.modules).toHaveLength(3);
		expect(catalog.modules).toEqual(
			expect.arrayContaining([
				{ slug: 'adrEnvelope', title: 'Adr Envelope', category: 'Envelopes' },
				{ slug: 'midiCodes', title: 'MIDI Codes', category: 'Functions/Midi Tools' },
				{ slug: 'sawUnsigned8bitInt', title: 'Saw Unsigned8bit Int', category: 'Oscillators' },
			])
		);
		expect(load).not.toHaveBeenCalled();
	});

	it('loads only requested sources, caches them, and resolves known dependencies', async () => {
		const loadEnvelope = vi.fn(async () => 'module adrEnv\nuse math\nuse env\nuse adrEnvelope\nmoduleEnd');
		const loadMath = vi.fn(async () => 'constants math\nconst PI 3.14159\nconstantsEnd');
		const catalog = createModuleCatalog(
			new Map([
				['envelopes/adrEnvelope', loadEnvelope],
				['constants/math', loadMath],
			])
		);
		const source = await catalog.getModule('adrEnvelope');
		expect(source).toContain('module adrEnv');
		expect(catalog.getDependenciesFromSource('adrEnvelope', source)).toEqual(['math']);
		await expect(catalog.getModule('adrEnvelope')).resolves.toContain('module adrEnv');
		expect(loadEnvelope).toHaveBeenCalledOnce();
		expect(loadMath).not.toHaveBeenCalled();
	});

	it('allows retrying a failed chunk load', async () => {
		const load = vi.fn(async () => 'source').mockRejectedValueOnce(new Error('Chunk unavailable'));
		const catalog = createModuleCatalog(new Map([['module', load]]));
		await expect(catalog.getModule('module')).rejects.toThrow('Chunk unavailable');
		await expect(catalog.getModule('module')).resolves.toBe('source');
	});

	it('rejects duplicate slugs across categories', () => {
		const load = async () => '';
		expect(() =>
			createModuleCatalog(
				new Map([
					['first/module', load],
					['second/module', load],
				])
			)
		).toThrow('Duplicate example module slug: module');
	});
});
