import type { Editor } from '@8f4e/editor-core';
import { createEditorTools } from './editor-tools.js';
import { referenceTools } from './reference-tools.js';
import { createWebMcpTool, type WebMcpModelContext } from './tool.js';

export type { WebMcpModelContext, WebMcpTool } from './tool.js';
export interface EditorWebMcpBridge {
	supported: boolean;
	/** Resolves after all tools are registered. Rejects on registration failure after removing partial registrations. */
	ready: Promise<void>;
	dispose(): void;
}
const activeDocuments = new WeakSet<Document>();
export function createEditorWebMcp({
	document,
	editor,
	getCompilerDiagnostics,
}: {
	document: Document;
	editor: Pick<Editor, 'editing' | 'navigation' | 'state'>;
	getCompilerDiagnostics?: () => unknown;
}): EditorWebMcpBridge {
	if (!editor?.editing || !editor.navigation)
		throw new Error('A single editor with editing and navigation handles is required');
	const context = (document as Document & { modelContext?: WebMcpModelContext }).modelContext;
	if (typeof context?.registerTool !== 'function') return { supported: false, ready: Promise.resolve(), dispose() {} };
	if (activeDocuments.has(document)) throw new Error('Only one 8f4e WebMCP bridge may be active per document');
	activeDocuments.add(document);
	const controller = new AbortController();
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		controller.abort();
		activeDocuments.delete(document);
	};
	const tools = [...referenceTools, ...createEditorTools(editor, getCompilerDiagnostics)].map(definition =>
		createWebMcpTool(definition, () => disposed)
	);
	const ready = (async () => {
		try {
			for (const definition of tools) {
				if (disposed) return;
				await context.registerTool(definition, { signal: controller.signal });
			}
		} catch (error) {
			const wasDisposed = disposed;
			dispose();
			if (!wasDisposed) throw error;
		}
	})();

	return { supported: true, ready, dispose };
}
