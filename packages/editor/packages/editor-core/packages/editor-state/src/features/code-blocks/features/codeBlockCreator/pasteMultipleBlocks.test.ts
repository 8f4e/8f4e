import { describe, expect, it } from 'vitest';

import { updateInterModuleReferences } from './pasteMultipleBlocks';

// Legacy direct operands below intentionally cover renaming projects using the current language.
// See docs/intermodular-push-audit.md for the language-removal follow-up.
describe('updateInterModuleReferences', () => {
	it('should update start address references (&module:memory)', () => {
		const code = ['float* buffer &oscillator:wave'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('float* buffer &oscillator2:wave');
	});

	it('should update end address references (module:memory&)', () => {
		const code = ['float* buffer oscillator:wave&'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('float* buffer oscillator2:wave&');
	});

	it('should update module end address references (module:&)', () => {
		const code = ['int buffer oscillator:&'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('int buffer oscillator2:&');
	});

	it('should update element count references (count(module:memory))', () => {
		const code = ['push count(oscillator:wave)'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('push count(oscillator2:wave)');
	});

	it('should update element word size references (sizeof(module:memory))', () => {
		const code = ['push sizeof(oscillator:wave)'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('push sizeof(oscillator2:wave)');
	});

	it('should update element max references (max(module:memory))', () => {
		const code = ['push max(oscillator:wave)'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('push max(oscillator2:wave)');
	});

	it('should update element min references (min(module:memory))', () => {
		const code = ['push min(oscillator:wave)'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('push min(oscillator2:wave)');
	});

	it('should update multiple references in the same line', () => {
		const code = ['copy &source:data destination:data& count(source:size)'];
		const nameMapping = new Map([
			['source', 'source2'],
			['destination', 'destination2'],
		]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('copy &source2:data destination2:data& count(source2:size)');
	});

	it('should handle multiple names in mapping', () => {
		const code = ['copy &osc1:wave &osc2:wave', 'push sizeof(osc1:buffer)'];
		const nameMapping = new Map([
			['osc1', 'osc3'],
			['osc2', 'osc4'],
		]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('copy &osc3:wave &osc4:wave');
		expect(result[1]).toBe('push sizeof(osc3:buffer)');
	});

	it('should not modify code when mapping is empty', () => {
		const code = ['float* buffer &oscillator:wave'];
		const nameMapping = new Map<string, string>();

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('float* buffer &oscillator:wave');
	});

	it('should not update partial matches', () => {
		const code = ['float* buffer &oscillatorMain:wave', 'push count(oscillatorMain:buffer)'];
		const nameMapping = new Map([['oscillator', 'oscillator2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		// Should not change oscillatorMain to oscillator2Main
		expect(result[0]).toBe('float* buffer &oscillatorMain:wave');
		expect(result[1]).toBe('push count(oscillatorMain:buffer)');
	});

	it('should handle special regex characters in names', () => {
		const code = ['float* buffer &test:data'];
		const nameMapping = new Map([['test', 'test2']]);

		const result = updateInterModuleReferences(code, nameMapping);

		expect(result[0]).toBe('float* buffer &test2:data');
	});
});
