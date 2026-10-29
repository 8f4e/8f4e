import { createMockState } from '@8f4e/editor-state-testing';
import createStateManager from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import { createEditorConfigSchemaContributionsValidator } from './schemaContributions';
import { resolveSchemaConfigRoot } from './schemaValidator';

const store = createStateManager(
	createMockState({
		editorConfigSchemaContributions: {
			settings: {
				root: 'settings',
				defaults: { scale: 1 },
				schema: {
					type: 'object',
					properties: {
						scale: { type: 'number', minimum: 1 },
						targetAddress: {
							format: 'memory-address',
							anyOf: [
								{ type: 'integer', minimum: 0 },
								{ type: 'string', pattern: '^[^:\\s]+:[^:\\s]+$' },
							],
						},
					},
				},
			},
		},
		editorConfig: {
			settings: {
				scale: 2,
				targetAddress: 'source:buffer',
			},
		},
		compiler: {
			projectMemoryExposuresByGroupPath: {},
			compiledModules: {},
			memoryPlan: {
				modules: {
					source: {
						id: 'source',
						lineNumber: 0,
						byteAddress: 0,
						allocationUnitCount: 0,
						allocatedByteLength: 0,
						endByteAddress: 0,
						endAddressSafeByteLength: 0,
						memory: {
							buffer: { id: 'buffer', allocationUnitAddress: 32 },
						},
						declarations: [],
						declarationSources: [],
					},
				},
				moduleList: [],
			},
			memoryDefaultsByModuleId: {},
		},
	})
);

describe('editor config schema contributions', () => {
	it('validates and parses values against contributed schemas', () => {
		const validator = createEditorConfigSchemaContributionsValidator(store);

		expect(
			validator.validate({
				path: 'settings.scale',
				value: '2',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBeUndefined();

		expect(validator.parse?.({ path: 'settings.scale', value: '2', sourceLineIndex: 1, codeBlockId: 0 })).toBe(2);
		expect(
			validator.parse?.({
				path: 'settings.targetAddress',
				value: '24',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe(24);
		expect(
			validator.parse?.({
				path: 'settings.targetAddress',
				value: 'source:buffer',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe('source:buffer');
		expect(
			validator.parse?.({
				path: 'settings.targetAddress',
				value: 'buffer',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBe('source:buffer');
		expect(
			validator.validate({
				path: 'settings.targetAddress',
				value: 'buffer',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBeUndefined();
		expect(
			validator.validate({
				path: 'settings.targetAddress',
				value: 'source',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config settings.targetAddress: invalid value 'source'");
		expect(
			validator.validate({
				path: 'settings.targetAddress',
				value: '&buffer',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBe("@config settings.targetAddress: invalid value '&buffer'");

		expect(
			validator.validate({
				path: 'settings.scale',
				value: '0',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe('@config settings.scale: value 0 must be at least 1');

		expect(
			validator.validate({
				path: 'settings.unknown',
				value: '1',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config: unknown config path 'settings.unknown'");
	});

	it('resolves memory-address formatted config values against compiled memory maps', () => {
		const state = store.getState();
		const config = resolveSchemaConfigRoot(state.editorConfigSchemaContributions.settings!, state.editorConfig, state);

		expect(config).toMatchObject({
			scale: 2,
			targetAddress: 32,
		});
	});

	it('validates dynamic object properties from additionalProperties schemas', () => {
		const dynamicStore = createStateManager(
			createMockState({
				editorConfigSchemaContributions: {
					bindings: {
						root: 'bindings',
						schema: {
							type: 'object',
							properties: {
								entries: {
									type: 'object',
									additionalProperties: {
										type: 'object',
										properties: {
											index: { type: 'integer', minimum: 0 },
											name: { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
										},
										additionalProperties: false,
									},
								},
							},
							additionalProperties: false,
						},
					},
				},
			})
		);
		const validator = createEditorConfigSchemaContributionsValidator(dynamicStore);

		expect(validator.knownPaths).toEqual(['bindings.entries.*.index', 'bindings.entries.*.name']);
		expect(
			validator.validate({
				path: 'bindings.entries.0.index',
				value: '0',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBeUndefined();
		expect(
			validator.validate({
				path: 'bindings.entries.0.name',
				value: 'exampleName',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBeUndefined();
		expect(
			validator.validate({
				path: 'bindings.entries.0.name',
				value: 'bad-name',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config bindings.entries.0.name: invalid string value 'bad-name'");
		expect(
			validator.validate({
				path: 'bindings.entries.0.unrelatedProperty',
				value: '1',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config: unknown config path 'bindings.entries.0.unrelatedProperty'");
	});

	it('parses module-memory-id formatted config values against the directive module', () => {
		const validator = createEditorConfigSchemaContributionsValidator(
			createStateManager(
				createMockState({
					editorConfigSchemaContributions: {
						targets: {
							root: 'targets',
							schema: {
								type: 'object',
								properties: {
									memory: {
										type: 'string',
										format: 'module-memory-id',
									},
								},
								additionalProperties: false,
							},
						},
					},
				})
			)
		);

		expect(
			validator.validate({
				path: 'targets.memory',
				value: 'value',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBeUndefined();
		expect(
			validator.parse?.({
				path: 'targets.memory',
				value: 'value',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBe('source:value');
		expect(
			validator.validate({
				path: 'targets.memory',
				value: 'value',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config targets.memory: memory value 'value' must include a module id outside module blocks");
		expect(
			validator.validate({
				path: 'targets.memory',
				value: '&value',
				sourceLineIndex: 1,
				codeBlockId: 0,
				moduleId: 'source',
			})
		).toBe("@config targets.memory: invalid string value '&value'");
	});
});
