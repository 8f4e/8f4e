import type { LogMessage, State } from '@8f4e/editor-state-types';

type LogLevel = LogMessage['level'];

function formatTimestamp(): string {
	const date = new Date();
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	return `${hours}:${minutes}:${seconds}`;
}

function addLogEntry(state: State, level: LogLevel, message: string, category?: string): void {
	const logEntry: LogMessage = {
		level,
		message: `${message}`,
		category: category ? `[${category}]` : undefined,
		timestamp: `[${formatTimestamp()}]`,
	};

	state.console.logs.push(logEntry);

	if (state.console.logs.length > state.console.maxLogs) {
		state.console.logs = state.console.logs.slice(-state.console.maxLogs);
	}
}

export function log(state: State, message: string, category?: string): void {
	addLogEntry(state, 'log', message, category);
}

export function warn(state: State, message: string, category?: string): void {
	addLogEntry(state, 'warn', message, category);
}

export function error(state: State, message: string, category?: string): void {
	addLogEntry(state, 'error', message, category);
}

export function info(state: State, message: string, category?: string): void {
	addLogEntry(state, 'info', message, category);
}
