import type { EditorLifecycleEvents } from '@8f4e/editor-state-types';
import { describe, expect, it, vi } from 'vitest';
import { createMockEventDispatcherWithVitest } from '~/__tests__/helpers/mockEventDispatcher';
import getProjectViewportPosition from './getProjectViewportPosition';

describe('project viewport placement', () => {
	it('prefers a remembered origin over contributed first-visit placement', () => {
		const events = createMockEventDispatcherWithVitest();
		expect(getProjectViewportPosition({ entries: [], path: '', blocks: [], viewport: { x: 0, y: 0 } }, events)).toEqual(
			{ x: 0, y: 0 }
		);
		expect(events.dispatch).not.toHaveBeenCalled();
	});

	it('uses a contributed position on a first visit', () => {
		const events = createMockEventDispatcherWithVitest();
		const project = { entries: [], path: 'Audio', blocks: [] };
		vi.mocked(events.dispatch).mockImplementation((name, payload) => {
			expect(name).toBe('resolveInitialProjectViewport');
			const request = payload as EditorLifecycleEvents['resolveInitialProjectViewport'];
			expect(request.project).toBe(project);
			expect(request.position).toEqual({ x: 0, y: 0 });
			request.position = { x: 840, y: 736 };
		});
		expect(getProjectViewportPosition(project, events)).toEqual({ x: 840, y: 736 });
		expect(events.dispatch).toHaveBeenCalledTimes(1);
	});

	it('starts at the origin without a remembered view or contribution', () => {
		const events = createMockEventDispatcherWithVitest();
		expect(getProjectViewportPosition({ entries: [], path: 'Audio', blocks: [] }, events)).toEqual({
			x: 0,
			y: 0,
		});
	});
});
