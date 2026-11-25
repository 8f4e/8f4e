import type { EventDispatcher } from '@8f4e/editor-state-types';
import { vi } from 'vitest';
import { createMockEventDispatcher } from './mockEditorState';

/**
 * Wraps a plain event dispatcher with vitest mocks for testing.
 * This allows tests to use vitest's mock functionality while keeping
 * the base testUtils framework-agnostic.
 */
export function createMockEventDispatcherWithVitest(): EventDispatcher {
	const baseDispatcher = createMockEventDispatcher();
	return {
		on: vi.fn(baseDispatcher.on) as EventDispatcher['on'],
		off: vi.fn(baseDispatcher.off) as EventDispatcher['off'],
		dispatch: vi.fn(baseDispatcher.dispatch) as EventDispatcher['dispatch'],
	};
}
