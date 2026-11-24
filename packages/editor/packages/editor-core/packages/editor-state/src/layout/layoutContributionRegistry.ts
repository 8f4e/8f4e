import type {
	CodeBlockGraphicData,
	CodeBlockLayoutContext,
	CodeBlockLayoutContribution,
	EditorLayoutRegistry,
} from '@8f4e/editor-state-types';

export interface LayoutRegistry extends EditorLayoutRegistry {
	getContribution: (codeBlock: CodeBlockGraphicData) => CodeBlockLayoutContribution;
	publish: (context: CodeBlockLayoutContext) => void;
}

export function createLayoutRegistry(onChange: (codeBlock?: CodeBlockGraphicData) => void): LayoutRegistry {
	const contributions = new Set<WeakMap<CodeBlockGraphicData, CodeBlockLayoutContribution>>();
	const listeners = new Set<(context: CodeBlockLayoutContext) => void>();
	return {
		createContribution: () => {
			const values = new WeakMap<CodeBlockGraphicData, CodeBlockLayoutContribution>();
			contributions.add(values);
			return {
				update: (codeBlock, value) => {
					const previous = values.get(codeBlock);
					if (
						previous?.minGridWidth === value.minGridWidth &&
						(previous?.verticalSpaceAfterSourceLine.length ?? 0) === value.verticalSpaceAfterSourceLine.length &&
						value.verticalSpaceAfterSourceLine.every((space, index) => {
							const old = previous!.verticalSpaceAfterSourceLine[index];
							return old.sourceLineIndex === space.sourceLineIndex && old.heightInRows === space.heightInRows;
						})
					)
						return;
					values.set(codeBlock, {
						minGridWidth: value.minGridWidth,
						verticalSpaceAfterSourceLine: value.verticalSpaceAfterSourceLine.map(space => ({ ...space })),
					});
					onChange(codeBlock);
				},
				remove: codeBlock => {
					if (values.delete(codeBlock)) onChange(codeBlock);
				},
				dispose: () => {
					if (contributions.delete(values)) onChange();
				},
			};
		},
		subscribe: listener => {
			listeners.add(listener);
			onChange();
			return () => {
				listeners.delete(listener);
			};
		},
		getContribution: codeBlock => {
			const verticalSpaceAfterSourceLine: CodeBlockLayoutContribution['verticalSpaceAfterSourceLine'][number][] = [];
			let minGridWidth: number | undefined;
			for (const values of contributions) {
				const value = values.get(codeBlock);
				if (!value) continue;
				verticalSpaceAfterSourceLine.push(...value.verticalSpaceAfterSourceLine);
				if (value.minGridWidth !== undefined) minGridWidth = Math.max(minGridWidth ?? 0, value.minGridWidth);
			}
			return { verticalSpaceAfterSourceLine, minGridWidth };
		},
		publish: context => {
			for (const listener of listeners) listener(context);
		},
	};
}
