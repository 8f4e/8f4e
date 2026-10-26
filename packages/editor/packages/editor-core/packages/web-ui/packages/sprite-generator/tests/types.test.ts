import { describe, expect, it } from 'vitest';
import type { DrawingCommand } from '../src/types';

import { Command } from '../src/types';

describe('Types and Enums', () => {
	describe('Command enum', () => {
		it('should have correct command values', () => {
			expect(Command.FILL_COLOR).toBe(0);
			expect(Command.RECTANGLE).toBe(1);
			expect(Command.TRANSLATE).toBe(2);
			expect(Command.SAVE).toBe(3);
			expect(Command.RESTORE).toBe(4);
			expect(Command.RESET_TRANSFORM).toBe(5);
			expect(Command.PIXEL).toBe(6);
		});

		it('should have all required command types', () => {
			const commandKeys = Object.keys(Command).filter(key => isNaN(Number(key)));
			expect(commandKeys).toContain('FILL_COLOR');
			expect(commandKeys).toContain('RECTANGLE');
			expect(commandKeys).toContain('TRANSLATE');
			expect(commandKeys).toContain('SAVE');
			expect(commandKeys).toContain('RESTORE');
			expect(commandKeys).toContain('RESET_TRANSFORM');
			expect(commandKeys).toContain('PIXEL');
		});
	});

	describe('DrawingCommand type validation', () => {
		it('should validate FILL_COLOR command structure', () => {
			const command: DrawingCommand = [Command.FILL_COLOR, '#ff0000'];
			expect(command[0]).toBe(Command.FILL_COLOR);
			expect(command[1]).toBe('#ff0000');
			expect(command.length).toBe(2);
		});

		it('should validate RECTANGLE command structure', () => {
			const command: DrawingCommand = [Command.RECTANGLE, 10, 20, 30, 40];
			expect(command[0]).toBe(Command.RECTANGLE);
			expect(command[1]).toBe(10);
			expect(command[2]).toBe(20);
			expect(command[3]).toBe(30);
			expect(command[4]).toBe(40);
			expect(command.length).toBe(5);
		});

		it('should validate TRANSLATE command structure', () => {
			const command: DrawingCommand = [Command.TRANSLATE, 5, 15];
			expect(command[0]).toBe(Command.TRANSLATE);
			expect(command[1]).toBe(5);
			expect(command[2]).toBe(15);
			expect(command.length).toBe(3);
		});

		it('should validate PIXEL command structure', () => {
			const command: DrawingCommand = [Command.PIXEL, 1, 2];
			expect(command[0]).toBe(Command.PIXEL);
			expect(command[1]).toBe(1);
			expect(command[2]).toBe(2);
			expect(command.length).toBe(3);
		});

		it('should validate commands without parameters', () => {
			const saveCommand: DrawingCommand = [Command.SAVE];
			const restoreCommand: DrawingCommand = [Command.RESTORE];
			const resetCommand: DrawingCommand = [Command.RESET_TRANSFORM];

			expect(saveCommand[0]).toBe(Command.SAVE);
			expect(saveCommand.length).toBe(1);

			expect(restoreCommand[0]).toBe(Command.RESTORE);
			expect(restoreCommand.length).toBe(1);

			expect(resetCommand[0]).toBe(Command.RESET_TRANSFORM);
			expect(resetCommand.length).toBe(1);
		});
	});
});
