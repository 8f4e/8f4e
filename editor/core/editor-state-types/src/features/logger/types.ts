/**
 * Types for state-backed editor logging.
 */

/**
 * Individual log message entry.
 */
export interface LogMessage {
	level: 'log' | 'warn' | 'error' | 'info';
	category?: string;
	timestamp: string;
	message: string;
}

/**
 * Console state for the internal logging buffer.
 */
export interface ConsoleState {
	logs: LogMessage[];
	maxLogs: number;
}
