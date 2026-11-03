/**
 * Shared types used across multiple features in editor-state.
 * These types do not belong to any single feature and are used by multiple subsystems.
 */

import type { CompilerSourceBlockType, ProjectGroupPath } from '@8f4e/language-spec';
import type { CodeBlockGraphicData } from '../features/code-blocks/types';

/**
 * Generic size dimensions used across features.
 */
export interface Size {
	width: number;
	height: number;
}

/**
 * Generic x,y position coordinates used across features.
 */
export interface Position {
	x: number;
	y: number;
}

/**
 * Grid coordinates represent logical cell positions in the editor grid.
 * These are distinct from pixel coordinates used at runtime.
 */
export interface GridCoordinates {
	x: number;
	y: number;
}

export interface EventSubscriptionOptions {
	/** Run before ordinary listeners, in capture registration order. */
	capture?: boolean;
}

/**
 * Event dispatcher interface for managing event subscriptions and dispatching.
 * Used throughout the editor for decoupled communication between features.
 */
export interface EventDispatcher {
	on: <T>(eventName: string, callback: (event: T) => void, options?: EventSubscriptionOptions) => void;
	off: <T>(eventName: string, callback: (event: T) => void) => void;
	dispatch: <T>(eventName: string, eventObject?: T, options?: EventDispatchOptions) => void;
}

export interface EventDispatchOptions {
	/** Deliver one phase only; omitted means capture followed by ordinary listeners. */
	phase?: 'capture' | 'normal';
}

/**
 * Device-independent pointer input translated by browser input adapters.
 */
export interface InternalPointerEvent {
	x: number;
	y: number;
	movementX: number;
	movementY: number;
	buttons: number;
	stopPropagation: boolean;
	canvasWidth: number;
	canvasHeight: number;
	/** Alt/Option key modifier state */
	altKey: boolean;
}

export interface CodeBlockPointerDownEvent {
	x: number;
	y: number;
	relativeX: number;
	relativeY: number;
	codeBlock: CodeBlockGraphicData;
	/** A control sets this when it takes ownership of the pointer. */
	stopPropagation: boolean;
}

/**
 * Shared code error shape used across compiler, directive, and config validation flows.
 */
export interface CodeError {
	lineNumber: number;
	message: string;
	/** Creation index of the code block that owns the error. */
	codeBlockId: number;
	codeBlockType?: CompilerSourceBlockType;
	/** Project scope that owns an error not associated with a document block id. */
	projectGroupPath?: ProjectGroupPath;
	/** Optional producer id for shared error buckets that contain errors from multiple owners. */
	ownerId?: string;
}
