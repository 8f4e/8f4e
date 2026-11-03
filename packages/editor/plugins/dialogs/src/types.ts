import type { DialogButton, DialogContent, Position, Size } from '@8f4e/editor-state-types';

export type DialogButtonLayout = DialogButton & Position & Size;

/** Derived presentation data, kept private to each installed plugin. */
export interface DialogLayout extends Omit<DialogContent, 'buttons'>, Position, Size {
	wrappedText: string[];
	buttons: DialogButtonLayout[];
	highlightedButton: number;
}
