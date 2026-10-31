import type { EditorPluginContext } from '@8f4e/editor-core';
import { gapCalculator, matchEditorDirectives } from '@8f4e/editor-state';
import { getCodeBlockMemoryScope, resolveMemoryIdentifier } from '@8f4e/editor-state/memory';
import type { CodeBlockGraphicData, EditorLayoutRegistry, MemoryIdentifier } from '@8f4e/editor-state-types';
import {
	parseTextureDirective,
	parseTextureUploadDirective,
	type TextureDirective,
	type TextureUploadDirective,
} from './directive';

interface Upload extends TextureUploadDirective {
	reference: string;
	binding: MemoryIdentifier | undefined;
}
export interface BlockTexture extends TextureDirective {
	reference: string;
	uploadHint?: TextureUploadDirective;
	binding: MemoryIdentifier | undefined;
	line: number;
	x: number;
	y: number;
	width: number;
	height: number;
	visible: boolean;
}

export function resolveTextureAddress(binding: MemoryIdentifier | undefined, memory: Int32Array): number | undefined {
	if (!binding) return;
	if (binding.showAddress) return binding.memory.byteAddress;
	if (!binding.memory.pointeeBaseType) return;
	const address = memory[binding.memory.allocationUnitAddress];
	return address === undefined ? undefined : address >>> 0;
}

export function createTextureLayout({
	store,
	layout,
	getMemory,
}: {
	store: EditorPluginContext['store'];
	layout: EditorLayoutRegistry;
	getMemory: () => WebAssembly.Memory | null;
}) {
	const state = store.getState();
	const contribution = layout.createContribution();
	const viewsByBlock = new Map<CodeBlockGraphicData, BlockTexture[]>();
	let uploads: Upload[] = [];
	const collect = (blocks: CodeBlockGraphicData[]): CodeBlockGraphicData[] =>
		blocks.flatMap(block => [block, ...collect(block.nestedProjectCodeBlocks ?? [])]);

	function resolveUploads(memory: Int32Array) {
		const sources = new Map<number, TextureUploadDirective>();
		const conflicts = new Set<number>();
		for (const upload of uploads) {
			const address = resolveTextureAddress(upload.binding, memory);
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

	function updateBlockLayout(block: CodeBlockGraphicData) {
		const views = viewsByBlock.get(block) ?? [];
		const displayed = views.filter(view => {
			view.visible = block.displayModel.sourceLineIndexToDisplayRow[view.line] !== undefined;
			return view.visible && view.width > 0 && view.height > 0;
		});
		const leftColumns = block.lineNumberColumnWidth + 2;
		contribution.update(block, {
			verticalSpaceAfterSourceLine: displayed.map(view => ({
				sourceLineIndex: view.line,
				heightInRows: Math.ceil((view.height * view.magnification) / state.viewport.hGrid),
			})),
			minGridWidth: displayed.length
				? leftColumns +
					Math.ceil(Math.max(...displayed.map(view => view.width * view.magnification)) / state.viewport.vGrid) +
					1
				: undefined,
		});
		const usedRows = new Map<number, number>();
		for (const view of displayed) {
			const preceding = usedRows.get(view.line) ?? 0;
			usedRows.set(view.line, preceding + Math.ceil((view.height * view.magnification) / state.viewport.hGrid));
			view.x = leftColumns * state.viewport.vGrid;
			view.y =
				(gapCalculator(block.displayModel.sourceLineIndexToDisplayRow[view.line]!, block.gaps) + 1 + preceding) *
				state.viewport.hGrid;
		}
	}

	function updateSizes(sources: ReadonlyMap<number, TextureUploadDirective>, memory: Int32Array) {
		for (const [block, views] of viewsByBlock) {
			let changed = false;
			for (const view of views) {
				const address = resolveTextureAddress(view.binding, memory);
				const source = (address === undefined ? undefined : sources.get(address)) ?? view.uploadHint;
				let width = view.crop?.width ?? source?.width ?? 0;
				let height = view.crop?.height ?? source?.height ?? 0;
				if (!Number.isSafeInteger(width * view.magnification) || !Number.isSafeInteger(height * view.magnification))
					width = height = 0;
				if (view.width !== width || view.height !== height) changed = true;
				view.width = width;
				view.height = height;
			}
			if (changed) updateBlockLayout(block);
		}
	}

	function refresh() {
		const previousBlocks = [...viewsByBlock.keys()];
		viewsByBlock.clear();
		uploads = [];
		for (const block of collect(state.codeBlockRendering.rootCodeBlocks)) {
			const scope = getCodeBlockMemoryScope(block);
			for (const directive of matchEditorDirectives(block.parsedDirectives, [{ name: 'textureUpload' }])) {
				const data = parseTextureUploadDirective(directive.args);
				if (data)
					uploads.push({
						...data,
						reference: `${JSON.stringify(scope)}:${data.address}`,
						binding: resolveMemoryIdentifier(state, scope, data.address),
					});
			}
			const views = matchEditorDirectives(block.parsedDirectives, [{ name: 'texture' }]).flatMap(directive => {
				const data = parseTextureDirective(directive.args);
				return data
					? [
							{
								...data,
								reference: `${JSON.stringify(scope)}:${data.address}`,
								binding: resolveMemoryIdentifier(state, scope, data.address),
								line: directive.sourceLineIndex,
								x: 0,
								y: 0,
								width: 0,
								height: 0,
								visible: false,
							},
						]
					: [];
			});
			if (views.length) viewsByBlock.set(block, views);
		}
		for (const views of viewsByBlock.values())
			for (const view of views) {
				const candidates = uploads.filter(upload => upload.reference === view.reference);
				const first = candidates[0];
				if (
					first &&
					candidates.every(
						upload => upload.format === first.format && upload.width === first.width && upload.height === first.height
					)
				)
					view.uploadHint = first;
			}
		for (const block of previousBlocks) if (!viewsByBlock.has(block)) contribution.remove(block);
		const buffer = getMemory()?.buffer;
		if (buffer) {
			const memory = new Int32Array(buffer);
			updateSizes(resolveUploads(memory).sources, memory);
		}
		for (const block of viewsByBlock.keys()) updateBlockLayout(block);
	}

	const unsubscribeLayout = layout.subscribe(({ codeBlock }) => updateBlockLayout(codeBlock));
	store.subscribe('projectChange', refresh);
	store.subscribeToValue('compiler.isCompiling', false, refresh);
	refresh();
	return {
		viewsByBlock,
		resolveUploads,
		updateSizes,
		dispose: () => {
			store.unsubscribe('projectChange', refresh);
			store.unsubscribe('compiler.isCompiling', refresh);
			unsubscribeLayout();
			contribution.dispose();
			viewsByBlock.clear();
			uploads = [];
		},
	};
}
