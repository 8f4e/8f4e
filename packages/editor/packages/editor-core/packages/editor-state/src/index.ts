export { formatKnownStackValue } from './compiler-metadata/formatKnownStackValue';
export { default as getCodeBlockModuleId } from './compiler-metadata/getCodeBlockModuleId';
export { getCompiledFunctionForCodeBlock } from './compiler-metadata/getCompiledFunctionForCodeBlock';
export { getCompiledModuleForCodeBlock } from './compiler-metadata/getCompiledModuleForCodeBlock';
export {
	type CurrentCompiledLine,
	getCurrentCompiledLineForCodeBlock,
} from './compiler-metadata/getCurrentCompiledLineForCodeBlock';
export { getStackOperandProducerRows } from './compiler-metadata/getStackOperandProducerRows';
export { createCodeErrorBlockLookup, default as getCodeBlockErrors } from './diagnostics/getCodeBlockErrors';
export { error as logError, log as logMessage } from './diagnostics/logging';
export { matchEditorDirectives } from './directives/directiveRecords';
export {
	removeDirective,
	updateDirectiveArgs,
	upsertDirective,
} from './directives/editing/index';
export {
	isMemoryAddress,
	isMemoryId,
	isMemoryTarget,
	isPointerSource,
	parseElementCount,
	parseFiniteNumber,
	parseInteger,
} from './directives/editorDirectiveArgumentTypes';
export { parseBlockDirectives } from './directives/parseBlockDirectives';
export { default as getExportBaseName } from './editor-config/getExportBaseName';
export {
	collectSchemaConfigPaths,
	createSchemaEditorConfigValidator,
	getSchemaForConfigPath,
	parseSchemaConfigValue,
	resolveSchemaConfigRoot,
	validateSchemaConfigValue,
} from './editor-config/schemaValidator';
export type { EditorStateStore } from './initializeEditorState';
export { default } from './initializeEditorState';
export type { ResolveCodeBlockDragTargetsEvent } from './input/blockDragging';
export {
	jumpToCodeBlock,
	navigateToCodeBlockInDirection,
} from './input/blockNavigation';
export { default as findClosestCodeBlockInDirection } from './input/findClosestCodeBlockInDirection';
export { default as getCodeBlockGridWidth } from './layout/getCodeBlockGridWidth';
export { subscribeToBlockPreparation } from './layout/subscribeToBlockPreparation';
export { clampSourcePosition } from './layout/text-geometry/clampSourcePosition';
export { default as gapCalculator } from './layout/text-geometry/displayRowToGridRow';
export {
	getRawIndexForVisualColumn,
	getTabAdvance,
	getTabStopsByLine,
	getVisualColumnForRawIndex,
	getVisualLineWidth,
} from './layout/text-geometry/tabLayout';
export { default as wrapText } from './layout/text-geometry/wrapText';
export { default as getCodeBlockNameFromSource } from './project/blocks/getCodeBlockNameFromSource';
export { default as getBlockType } from './project/blocks/getCodeBlockTypeFromSource';
export { default as setSkipExecution } from './project/blocks/setSkipExecution';
export type {
	EditorEdit,
	EditorEditingHandle,
	EditorEditResult,
	EditorNavigationHandle,
} from './project/commandApi';
export { createEditorEditingHandle, EditorEditingError, getEditorBlockId } from './project/commandApi';
export { deleteCodeBlocks } from './project/deleteCodeBlocks';
export { EMPTY_DEFAULT_PROJECT } from './project/emptyDefaultProject';
export { insertCodeBlock } from './project/insertCodeBlock';
export { insertCodeBlocks } from './project/insertCodeBlocks';
export { applyCodeBlockSourceEdits } from './project/replaceBlockSources';
export { type SerializedCodeBlock, serializeCodeBlocks } from './project/serialization/codeBlockSerialization';
export { default as serializeProjectLevel } from './project/serialization/serializeProjectLevel';
export { default as serializeToProject } from './project/serialization/serializeToProject';
export { findParentProjectLevel, walkProjectBlocks, walkProjectLevels } from './project/tree';
export type { CodeBlockBounds } from './viewport/centerViewportOnCodeBlock';
export { default as centerViewportOnCodeBlock } from './viewport/centerViewportOnCodeBlock';
export { markGridSizePending, setGridSize } from './viewport/gridSize';
export { default as updateViewport } from './viewport/updateViewport';
