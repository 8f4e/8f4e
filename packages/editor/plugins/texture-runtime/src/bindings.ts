import type { EditorPluginContext } from '@8f4e/editor-core';
import { matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, MemoryIdentifier } from '@8f4e/editor-state-types';
import { parseTextureDirective, parseTextureUploadDirective, type TextureUploadDirective } from './directive';

interface Upload extends TextureUploadDirective {
	binding: MemoryIdentifier | undefined;
}

function resolveAddress(binding: MemoryIdentifier | undefined, memory: Int32Array): number | undefined {
	if (!binding) return;
	if (binding.showAddress) return binding.memory.byteAddress;
	if (!binding.memory.pointeeBaseType) return;
	const address = memory[binding.memory.allocationUnitAddress];
	return address === undefined ? undefined : address >>> 0;
}

export function createTextureBindings(store: EditorPluginContext['store']) {
	const state = store.getState();
	const bindingsByBlock = new WeakMap<CodeBlockGraphicData, Map<string, MemoryIdentifier | undefined>>();
	let uploads: Upload[] = [];

	function collect(blocks: CodeBlockGraphicData[]) {
		for (const block of blocks) {
			const scope = getCodeBlockMemoryScope(block);
			const bindings = new Map<string, MemoryIdentifier | undefined>();
			for (const directive of matchEditorDirectives(block.parsedDirectives, [{ name: 'textureUpload' }])) {
				const data = parseTextureUploadDirective(directive.args);
				if (!data) continue;
				const binding = resolveMemoryIdentifier(state, scope, data.address);
				bindings.set(data.address, binding);
				uploads.push({ ...data, binding });
			}
			for (const directive of matchEditorDirectives(block.parsedDirectives, [{ name: 'texture' }])) {
				const data = parseTextureDirective(directive.args);
				if (data && !bindings.has(data.address))
					bindings.set(data.address, resolveMemoryIdentifier(state, scope, data.address));
			}
			bindingsByBlock.set(block, bindings);
			collect(block.childProject?.blocks ?? []);
		}
	}

	function refresh() {
		uploads = [];
		collect(state.codeBlockRendering.rootProject.blocks);
	}

	function resolveUploads(memory: Int32Array) {
		const sources = new Map<number, TextureUploadDirective>();
		const conflicts = new Set<number>();
		for (const upload of uploads) {
			const address = resolveAddress(upload.binding, memory);
			if (address === undefined || conflicts.has(address)) continue;
			const previous = sources.get(address);
			if (
				previous &&
				(previous.format !== upload.format || previous.width !== upload.width || previous.height !== upload.height)
			) {
				sources.delete(address);
				conflicts.add(address);
			} else sources.set(address, upload);
		}
		return { sources, conflicts };
	}

	store.subscribe('projectChange', refresh);
	store.subscribe('compiler.result', refresh);
	refresh();
	return {
		resolveUploads,
		resolveViewAddress: (block: CodeBlockGraphicData, address: string, memory: Int32Array) =>
			resolveAddress(bindingsByBlock.get(block)?.get(address), memory),
		dispose: () => {
			store.unsubscribe('projectChange', refresh);
			store.unsubscribe('compiler.result', refresh);
			uploads = [];
		},
	};
}
