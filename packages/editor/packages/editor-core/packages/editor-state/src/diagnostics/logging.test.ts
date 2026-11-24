import type { State } from '@8f4e/editor-state-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockState } from '~/__tests__/helpers/mockEditorState';
import { error, info, log, warn } from './logging';

describe('logger', () => {
	let mockState: State;

	beforeEach(() => {
		mockState = createMockState();
	});

	describe('log', () => {
		it('should add a log entry with level "log"', () => {
			log(mockState, 'Test message');

			expect(mockState.console.logs).toHaveLength(1);
			expect(mockState.console.logs[0].level).toBe('log');
			expect(mockState.console.logs[0].message).toBe('Test message');
			expect(mockState.console.logs[0].timestamp).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
			expect(mockState.console.logs[0].category).toBeUndefined();
		});

		it('should add a log entry with category', () => {
			log(mockState, 'Test message', 'TestCategory');

			expect(mockState.console.logs[0].message).toBe('Test message');
			expect(mockState.console.logs[0].category).toBe('[TestCategory]');
		});
	});

	describe('warn', () => {
		it('should add a log entry with level "warn"', () => {
			warn(mockState, 'Warning message');

			expect(mockState.console.logs[0].level).toBe('warn');
			expect(mockState.console.logs[0].message).toBe('Warning message');
			expect(mockState.console.logs[0].timestamp).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
		});
	});

	describe('error', () => {
		it('should add a log entry with level "error"', () => {
			error(mockState, 'Error message');

			expect(mockState.console.logs[0].level).toBe('error');
			expect(mockState.console.logs[0].message).toBe('Error message');
			expect(mockState.console.logs[0].timestamp).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
		});
	});

	describe('info', () => {
		it('should add a log entry with level "info"', () => {
			info(mockState, 'Info message');

			expect(mockState.console.logs[0].level).toBe('info');
			expect(mockState.console.logs[0].message).toBe('Info message');
			expect(mockState.console.logs[0].timestamp).toMatch(/^\[\d{2}:\d{2}:\d{2}\]$/);
		});
	});

	describe('circular buffer', () => {
		it('should limit logs to maxLogs', () => {
			mockState.console.maxLogs = 5;

			for (let i = 0; i < 10; i++) {
				log(mockState, `Message ${i}`);
			}

			expect(mockState.console.logs).toHaveLength(5);
			expect(mockState.console.logs[0].message).toBe('Message 5');
			expect(mockState.console.logs[4].message).toBe('Message 9');
		});
	});
});
